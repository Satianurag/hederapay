import { Router, Request, Response } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { prisma } from "../config/db";
import { logAudit } from "../utils/audit";

const router = Router();

// POST /api/lp/deposit — record a deposit (frontend signs tx, backend records)
router.post("/deposit", authenticate, authorize("LP"), async (req: Request, res: Response) => {
  try {
    const { amount, txHash } = req.body;

    if (!amount || !txHash) {
      res.status(400).json({ error: "amount and txHash are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.walletAddress) {
      res.status(400).json({ error: "Wallet not linked. Link wallet first." });
      return;
    }

    const existing = await prisma.deposit.findUnique({ where: { txHash } });
    if (existing) {
      res.status(409).json({ error: "Transaction already recorded" });
      return;
    }

    const deposit = await prisma.deposit.create({
      data: {
        lpAddress: user.walletAddress,
        amount,
        txHash,
        status: "pending",
      },
    });

    await logAudit(req.user!.email, "DEPOSIT_RECORDED", {
      amount,
      txHash,
      lpAddress: user.walletAddress,
    });

    res.status(201).json({ deposit });
  } catch (err: any) {
    console.error("Deposit error:", err.message);
    res.status(500).json({ error: "Deposit recording failed" });
  }
});

// GET /api/lp/balance — get LP's deposit, claimable yield, and history
router.get("/balance", authenticate, authorize("LP"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.walletAddress) {
      res.status(400).json({ error: "Wallet not linked" });
      return;
    }

    const deposits = await prisma.deposit.findMany({
      where: { lpAddress: user.walletAddress },
      orderBy: { createdAt: "desc" },
    });

    const totalDeposited = deposits
      .filter((d) => d.status === "confirmed")
      .reduce((sum, d) => sum + BigInt(d.amount), 0n);

    const pool = await prisma.pool.findFirst({ where: { initialized: true } });

    res.json({
      walletAddress: user.walletAddress,
      totalDeposited: totalDeposited.toString(),
      investorAPY: pool?.investorAPY || 0,
      deposits,
    });
  } catch (err: any) {
    console.error("Balance error:", err.message);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

// POST /api/lp/withdraw — record a withdrawal request
router.post("/withdraw", authenticate, authorize("LP"), async (req: Request, res: Response) => {
  try {
    const { txHash } = req.body;

    if (!txHash) {
      res.status(400).json({ error: "txHash is required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.walletAddress) {
      res.status(400).json({ error: "Wallet not linked" });
      return;
    }

    await logAudit(req.user!.email, "WITHDRAWAL_RECORDED", {
      txHash,
      lpAddress: user.walletAddress,
    });

    res.json({ message: "Withdrawal recorded", txHash });
  } catch (err: any) {
    console.error("Withdraw error:", err.message);
    res.status(500).json({ error: "Withdrawal recording failed" });
  }
});

// GET /api/lp/history — get deposit/withdrawal history
router.get("/history", authenticate, authorize("LP"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.walletAddress) {
      res.status(400).json({ error: "Wallet not linked" });
      return;
    }

    const deposits = await prisma.deposit.findMany({
      where: { lpAddress: user.walletAddress },
      orderBy: { createdAt: "desc" },
    });

    res.json({ deposits });
  } catch (err: any) {
    console.error("History error:", err.message);
    res.status(500).json({ error: "Failed to get history" });
  }
});

export default router;
