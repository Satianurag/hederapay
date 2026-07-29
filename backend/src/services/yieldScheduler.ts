import { prisma } from "../config/db";
import { logAudit } from "../utils/audit";

const YIELD_CYCLE_DAYS = 7;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

let intervalId: NodeJS.Timeout | null = null;

export function startYieldScheduler(): void {
  console.log("Yield scheduler: started (checking every hour)");

  checkYieldCycle();
  intervalId = setInterval(checkYieldCycle, CHECK_INTERVAL_MS);
}

async function checkYieldCycle(): Promise<void> {
  try {
    const pool = await prisma.pool.findFirst({ where: { initialized: true } });
    if (!pool) return;

    const lastCycle = await prisma.yieldDistribution.findFirst({
      orderBy: { cycle: "desc" },
    });

    const now = new Date();
    let isDue = false;

    if (!lastCycle) {
      const poolAge = now.getTime() - pool.createdAt.getTime();
      const cycleDurationMs = YIELD_CYCLE_DAYS * 24 * 60 * 60 * 1000;
      isDue = poolAge >= cycleDurationMs;
    } else {
      const timeSinceLastCycle = now.getTime() - lastCycle.createdAt.getTime();
      const cycleDurationMs = YIELD_CYCLE_DAYS * 24 * 60 * 60 * 1000;
      isDue = timeSinceLastCycle >= cycleDurationMs;
    }

    if (isDue) {
      console.log("Yield scheduler: Distribution cycle is DUE");

      const confirmedDeposits = await prisma.$queryRaw<
        Array<{ lp_address: string; total: string }>
      >`
        SELECT "lpAddress" AS lp_address, SUM(amount::numeric)::text AS total
        FROM "Deposit"
        WHERE status = 'confirmed'
        GROUP BY "lpAddress"
      `;

      if (confirmedDeposits.length === 0) {
        console.log("Yield scheduler: No confirmed deposits, skipping");
        return;
      }

      const apyBps = BigInt(pool.investorAPY);
      const payouts = confirmedDeposits.map((d) => {
        const principal = BigInt(d.total);
        const yieldAmount = (principal * apyBps * 7n) / (360n * 10000n);
        return {
          address: d.lp_address,
          amount: yieldAmount.toString(),
          principal: principal.toString(),
        };
      });

      const totalYield = payouts.reduce((sum, p) => sum + BigInt(p.amount), 0n);

      console.log(
        `Yield scheduler: ${payouts.length} LPs, total yield: ${totalYield.toString()}`
      );

      await logAudit("system:yield-scheduler", "YIELD_CYCLE_DUE", {
        cycle: (lastCycle?.cycle || 0) + 1,
        lpCount: payouts.length,
        totalYield: totalYield.toString(),
        payouts: payouts.map((p) => ({
          address: p.address,
          amount: p.amount,
        })),
      });
    }
  } catch (err: any) {
    console.error("Yield scheduler error:", err.message);
  }
}

export function stopYieldScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("Yield scheduler stopped");
  }
}
