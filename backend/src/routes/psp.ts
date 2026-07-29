import { Prisma } from "@prisma/client";
import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/auth";
import { prisma } from "../config/db";
import { type KYBProfile, type KYRScore } from "../models";
import { logAudit } from "../utils/audit";
import { env } from "../config/env";
import {
  assessCreditRisk,
  applyDrawdownRiskDecision,
} from "../services/creditRiskService";

const router = Router();

// POST /api/psp/onboard — submit KYB profile
router.post("/onboard", authenticate, authorize("PSP"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.kybProfile) {
      res.status(400).json({ error: "KYB profile already submitted" });
      return;
    }

    const {
      companyName,
      registrationNumber,
      jurisdiction,
      dateOfIncorporation,
      yearsInOperation,
      licenseType,
      licenseNumber,
      issuingAuthority,
      businessType,
      monthlyTransactionVolume,
      primaryCorridors,
      settlementPartners,
      settlementCycle,
      annualRevenue,
      netIncome,
      totalEquity,
      debtRatio,
      bankRelationships,
      amlPolicyInPlace,
      sanctionsScreeningProvider,
      lastRegulatoryAuditDate,
      enforcementActions,
      documents,
    } = req.body;

    if (!companyName || !registrationNumber || !jurisdiction || !businessType || !settlementCycle) {
      res.status(400).json({
        error: "Missing required fields: companyName, registrationNumber, jurisdiction, businessType, settlementCycle",
      });
      return;
    }

    const kybProfile: KYBProfile = {
      companyName,
      registrationNumber,
      jurisdiction,
      dateOfIncorporation: dateOfIncorporation || "",
      yearsInOperation: yearsInOperation || 0,
      licenseType: licenseType || "",
      licenseNumber: licenseNumber || "",
      issuingAuthority: issuingAuthority || "",
      businessType,
      monthlyTransactionVolume: monthlyTransactionVolume || 0,
      primaryCorridors: primaryCorridors || [],
      settlementPartners: settlementPartners || [],
      settlementCycle,
      annualRevenue: annualRevenue || 0,
      netIncome: netIncome || 0,
      totalEquity: totalEquity || 0,
      debtRatio: debtRatio || 0,
      bankRelationships: bankRelationships || [],
      amlPolicyInPlace: amlPolicyInPlace ?? false,
      sanctionsScreeningProvider: sanctionsScreeningProvider || "",
      lastRegulatoryAuditDate: lastRegulatoryAuditDate || "",
      enforcementActions: enforcementActions ?? false,
      documents: documents || {},
    };

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { kybProfile: kybProfile as unknown as Prisma.InputJsonValue },
    });

    await logAudit(req.user!.email, "KYB_SUBMITTED", {
      companyName,
      registrationNumber,
      jurisdiction,
      businessType,
    });

    res.json({
      message: "KYB profile submitted. Pending admin approval.",
      approvalStatus: updatedUser.approvalStatus,
    });
  } catch (err: any) {
    console.error("Onboard error:", err.message);
    res.status(500).json({ error: "Onboarding failed" });
  }
});

// GET /api/psp/profile — get own PSP profile
router.get("/profile", authenticate, authorize("PSP"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const kybProfile = user.kybProfile as KYBProfile | null;
    const kyrScore = user.kyrScore as KYRScore | null;

    res.json({
      email: user.email,
      walletAddress: user.walletAddress,
      approved: user.approved,
      approvalStatus: user.approvalStatus,
      kybProfile,
      kyrScore,
    });
  } catch (err: any) {
    console.error("Get PSP profile error:", err.message);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// POST /api/psp/request-drawdown — request a drawdown
router.post(
  "/request-drawdown",
  authenticate,
  authorize("PSP"),
  async (req: Request, res: Response) => {
    try {
      const { amount } = req.body;

      if (!amount) {
        res.status(400).json({ error: "amount is required" });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!user.approved) {
        res.status(403).json({ error: "PSP not approved. Complete onboarding first." });
        return;
      }

      if (!user.walletAddress) {
        res.status(400).json({ error: "Wallet not linked" });
        return;
      }

      const pool = await prisma.pool.findFirst({ where: { initialized: true } });
      if (!pool) {
        res.status(400).json({ error: "Pool not initialized" });
        return;
      }

      const amountBig = BigInt(amount);
      const limitBig = BigInt(pool.drawdownLimit);
      if (amountBig > limitBig) {
        res.status(400).json({ error: "Amount exceeds drawdown limit" });
        return;
      }

      const activeDrawdown = await prisma.drawdown.findFirst({
        where: {
          pspAddress: user.walletAddress,
          status: { in: ["pending_approval", "approved", "executed", "shortfall"] },
        },
      });
      if (activeDrawdown) {
        res.status(400).json({ error: "Active drawdown exists. Repay before requesting another." });
        return;
      }

      const availableBig = BigInt(pool.availableLiquidity);

      const storedKyrScore = user.kyrScore as KYRScore | null;
      let riskScore = storedKyrScore?.totalScore;
      let riskRating = storedKyrScore?.rating;
      let riskRecommendation: string | undefined;
      let approvedAmount = amount;
      let drawdownStatus: "pending_approval" | "approved" | "rejected" = "approved";
      let adminApprovalRequired = false;
      let riskMessage = "";

      if (env.CREDIT_RISK_ENABLED) {
        try {
          const assessment = await assessCreditRisk(user.walletAddress);
          const decision = applyDrawdownRiskDecision(amount, pool.drawdownLimit, assessment);

          riskScore = assessment.overallRiskScore;
          riskRating = assessment.overallRating;
          riskRecommendation = assessment.recommendation;
          approvedAmount = decision.amount;
          drawdownStatus = decision.status;
          adminApprovalRequired = decision.adminApprovalRequired;
          riskMessage = decision.message;

          if (!decision.approved) {
            const rejected = await prisma.drawdown.create({
              data: {
                pspAddress: user.walletAddress,
                amount,
                status: "rejected",
                adminApprovalRequired: false,
                riskScore,
                riskRating,
                riskRecommendation,
              },
            });

            await logAudit(req.user!.email, "DRAWDOWN_DECLINED", {
              amount,
              pspAddress: user.walletAddress,
              drawdownId: rejected.id,
              riskScore,
              riskRating,
              recommendation: assessment.recommendation,
            });

            res.status(403).json({
              error: decision.message,
              drawdown: rejected,
              creditAssessment: assessment,
            });
            return;
          }

          if (BigInt(approvedAmount) > limitBig) {
            res.status(400).json({ error: "Amount exceeds drawdown limit after risk adjustment" });
            return;
          }
        } catch (err: any) {
          console.warn("Credit risk assessment failed, using KYR fallback:", err.message);
          riskMessage = "Credit risk service unavailable — using stored KYR score.";
        }
      }

      const drawdown = await prisma.drawdown.create({
        data: {
          pspAddress: user.walletAddress,
          amount: approvedAmount,
          status: drawdownStatus,
          adminApprovalRequired,
          riskScore,
          riskRating,
          riskRecommendation,
        },
      });

      await logAudit(req.user!.email, "DRAWDOWN_REQUESTED", {
        amount: approvedAmount,
        requestedAmount: amount,
        pspAddress: user.walletAddress,
        drawdownId: drawdown.id,
        availableLiquidity: pool.availableLiquidity,
        sufficientLiquidity: availableBig >= BigInt(approvedAmount),
        riskScore,
        riskRating,
        riskRecommendation,
      });

      const sufficientLiquidity = availableBig >= BigInt(approvedAmount);
      const defaultMessage = adminApprovalRequired
        ? "Drawdown pending admin approval"
        : sufficientLiquidity
          ? "Drawdown approved. Sign the transaction in your wallet."
          : "Drawdown approved but liquidity shortfall expected. Hedera automation will source liquidity via SaucerSwap.";

      res.status(201).json({
        drawdown,
        sufficientLiquidity,
        message: riskMessage || defaultMessage,
        riskScore,
        riskRating,
        riskRecommendation,
      });
    } catch (err: any) {
      console.error("Drawdown request error:", err.message);
      res.status(500).json({ error: "Drawdown request failed" });
    }
  }
);

// GET /api/psp/position — get active position and history
router.get("/position", authenticate, authorize("PSP"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.walletAddress) {
      res.status(400).json({ error: "Wallet not linked" });
      return;
    }

    const drawdowns = await prisma.drawdown.findMany({
      where: { pspAddress: user.walletAddress },
      orderBy: { createdAt: "desc" },
    });

    const repayments = await prisma.repayment.findMany({
      where: { pspAddress: user.walletAddress },
      orderBy: { createdAt: "desc" },
    });

    const activeDrawdown = drawdowns.find((d) =>
      ["pending_approval", "approved", "executed", "shortfall"].includes(d.status)
    );

    let accruedFee: string | null = null;
    if (activeDrawdown && activeDrawdown.executedAt) {
      const pool = await prisma.pool.findFirst({ where: { initialized: true } });
      if (pool) {
        const daysElapsed = Math.max(
          1,
          Math.floor(
            (Date.now() - activeDrawdown.executedAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        const fee =
          (BigInt(activeDrawdown.amount) * BigInt(pool.pspRatePerDay) * BigInt(daysElapsed)) /
          10_000n;
        accruedFee = fee.toString();
      }
    }

    res.json({
      activeDrawdown: activeDrawdown
        ? { ...activeDrawdown, accruedFee }
        : null,
      drawdownHistory: drawdowns,
      repaymentHistory: repayments,
    });
  } catch (err: any) {
    console.error("Position error:", err.message);
    res.status(500).json({ error: "Failed to get position" });
  }
});

// POST /api/psp/repay — record a repayment
router.post("/repay", authenticate, authorize("PSP"), async (req: Request, res: Response) => {
  try {
    const { amount, token, tokenSymbol, txHash } = req.body;

    if (!amount || !token || !tokenSymbol || !txHash) {
      res.status(400).json({ error: "amount, token, tokenSymbol, and txHash are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.walletAddress) {
      res.status(400).json({ error: "Wallet not linked" });
      return;
    }

    const activeDrawdown = await prisma.drawdown.findFirst({
      where: {
        pspAddress: user.walletAddress,
        status: "executed",
      },
    });
    if (!activeDrawdown) {
      res.status(400).json({ error: "No active executed drawdown to repay" });
      return;
    }

    const existing = await prisma.repayment.findUnique({ where: { txHash } });
    if (existing) {
      res.status(409).json({ error: "Transaction already recorded" });
      return;
    }

    const repayment = await prisma.repayment.create({
      data: {
        pspAddress: user.walletAddress,
        amount,
        token,
        tokenSymbol,
        txHash,
        status: "pending",
      },
    });

    await logAudit(req.user!.email, "REPAYMENT_RECORDED", {
      amount,
      token: tokenSymbol,
      txHash,
      pspAddress: user.walletAddress,
      drawdownId: activeDrawdown.id,
    });

    res.status(201).json({
      repayment,
      message:
        tokenSymbol === "USDC"
          ? "USDC repayment recorded. Awaiting on-chain confirmation."
          : `${tokenSymbol} repayment recorded. Hedera automation will convert to WHBAR via SaucerSwap.`,
    });
  } catch (err: any) {
    console.error("Repay error:", err.message);
    res.status(500).json({ error: "Repayment recording failed" });
  }
});

export default router;
