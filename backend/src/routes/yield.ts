import { Router, Request, Response } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { prisma } from "../config/db";
import { logAudit } from "../utils/audit";

const router = Router();

// GET /api/yield/status — yield reserve status and cycle info
router.get("/status", authenticate, async (_req: Request, res: Response) => {
  try {
    const pool = await prisma.pool.findFirst({ where: { initialized: true } });
    const lastCycle = await prisma.yieldDistribution.findFirst({
      orderBy: { cycle: "desc" },
    });

    const distributions = await prisma.yieldDistribution.findMany({
      select: { totalDistributed: true },
    });
    const allTimeTotal = distributions.reduce(
      (sum, d) => sum + BigInt(d.totalDistributed),
      0n
    );

    const nextCycleDate = lastCycle
      ? new Date(lastCycle.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      : null;

    res.json({
      investorAPY: pool?.investorAPY || 0,
      lastCycle: lastCycle
        ? {
            cycle: lastCycle.cycle,
            totalDistributed: lastCycle.totalDistributed,
            date: lastCycle.createdAt,
          }
        : null,
      nextCycleDate,
      allTimeDistributed: allTimeTotal.toString(),
    });
  } catch (err: any) {
    console.error("Yield status error:", err.message);
    res.status(500).json({ error: "Failed to get yield status" });
  }
});

// POST /api/yield/trigger-distribution — manually trigger yield distribution record
router.post(
  "/trigger-distribution",
  authenticate,
  authorize("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { lpPayouts, txHash } = req.body;

      if (!lpPayouts || !Array.isArray(lpPayouts) || lpPayouts.length === 0) {
        res.status(400).json({ error: "lpPayouts array is required" });
        return;
      }

      const lastCycle = await prisma.yieldDistribution.findFirst({
        orderBy: { cycle: "desc" },
      });
      const nextCycle = (lastCycle?.cycle || 0) + 1;

      const totalDistributed = lpPayouts.reduce(
        (sum: bigint, p: { amount: string }) => sum + BigInt(p.amount),
        0n
      );

      const distribution = await prisma.yieldDistribution.create({
        data: {
          cycle: nextCycle,
          totalDistributed: totalDistributed.toString(),
          lpPayouts,
          txHash,
        },
      });

      await logAudit(req.user!.email, "YIELD_DISTRIBUTED", {
        cycle: nextCycle,
        totalDistributed: totalDistributed.toString(),
        lpCount: lpPayouts.length,
        txHash,
      });

      res.status(201).json({ distribution });
    } catch (err: any) {
      console.error("Yield distribution error:", err.message);
      res.status(500).json({ error: "Yield distribution failed" });
    }
  }
);

// GET /api/yield/history — all distribution cycles
router.get("/history", authenticate, async (_req: Request, res: Response) => {
  try {
    const distributions = await prisma.yieldDistribution.findMany({
      orderBy: { cycle: "desc" },
    });
    res.json({ distributions });
  } catch (err: any) {
    console.error("Yield history error:", err.message);
    res.status(500).json({ error: "Failed to get yield history" });
  }
});

export default router;
