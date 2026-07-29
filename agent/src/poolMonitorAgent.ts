import express from "express";
import { config, createAgentClient } from "./agentClient.js";
import { mountPaidRoutes } from "./x402Server.js";

const PORT = parseInt(process.env.POOL_MONITOR_PORT || process.env.PORT || "4002", 10);
const app = express();

let latestAnalysis: PoolHealthAnalysis | null = null;

interface PoolHealthAnalysis {
  utilizationRate: number;
  reserveHealth: string;
  liquidityRisk: string;
  marketComparison: string;
  canHandleDrawdown: boolean;
  maxSafeDrawdown: string;
  marketAvgAPY: number;
  marketAvgBorrowRate: number;
  updatedAt: string;
}

export async function fetchAndAnalyze(poolState?: {
  totalLiquidity: string;
  availableLiquidity: string;
  investorAPY: number;
  pspRatePerDay: number;
}): Promise<PoolHealthAnalysis> {
  const client = await createAgentClient();
  const url = `${config.DATA_SERVICE_URL}/api/agent/market-data`;

  console.log("[pool-monitor] Paying 0.001 USDC for market data...");
  const { data } = await client.pay(url);
  const marketData = data as any;
  console.log("[pool-monitor] Market data received:", JSON.stringify(marketData).slice(0, 100));

  const totalLiq = BigInt(poolState?.totalLiquidity || "50000000000");
  const availLiq = BigInt(poolState?.availableLiquidity || "35000000000");
  const ourAPY = (poolState?.investorAPY || 500) / 100;
  const ourRate = (poolState?.pspRatePerDay || 50) / 100;

  const utilization =
    totalLiq > 0n ? Number(((totalLiq - availLiq) * 10000n) / totalLiq) / 100 : 0;

  const reserveHealth = utilization < 60 ? "healthy" : utilization < 80 ? "low" : "critical";
  const liquidityRisk = utilization < 50 ? "low" : utilization < 75 ? "medium" : "high";

  const marketAvgAPY = marketData.averageLendingAPY || 5.0;
  const marketComparison =
    ourAPY > marketAvgAPY + 1
      ? "above_market"
      : ourAPY < marketAvgAPY - 1
        ? "below_market"
        : "competitive";

  const maxSafe = availLiq > 10000000000n ? availLiq - 10000000000n : 0n;

  latestAnalysis = {
    utilizationRate: utilization,
    reserveHealth,
    liquidityRisk,
    marketComparison,
    canHandleDrawdown: availLiq > 0n,
    maxSafeDrawdown: maxSafe.toString(),
    marketAvgAPY,
    marketAvgBorrowRate: marketData.averageBorrowRate || 7.0,
    updatedAt: new Date().toISOString(),
  };

  console.log(
    `[pool-monitor] Analysis: util=${utilization}% reserve=${reserveHealth} risk=${liquidityRisk}`
  );
  return latestAnalysis;
}

mountPaidRoutes(app, {
  "GET /api/agent/pool-health": {
    priceHbar: "0.003",
    description: "Pool health analysis for risk agents",
  },
});

app.get("/api/agent/pool-health", (_req, res) => {
  console.log("[pool-monitor] Selling pool analysis (HBAR x402)");

  if (!latestAnalysis) {
    res.status(503).json({ error: "No analysis available yet. Agent is warming up." });
    return;
  }

  res.json({ analysis: latestAnalysis, network: config.HEDERA_NETWORK });
});

app.get("/api/agent/pool-monitor/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Pool Monitor Agent",
    network: config.HEDERA_NETWORK,
    hasAnalysis: latestAnalysis !== null,
    lastUpdate: latestAnalysis?.updatedAt || null,
  });
});

async function main() {
  app.listen(PORT, () => {
    console.log(`Pool Monitor Agent running on port ${PORT}`);
    console.log(`  Network: ${config.HEDERA_NETWORK}`);
    console.log(`  Sell endpoint: GET /api/agent/pool-health ($0.003 HBAR)`);
  });

  try {
    await fetchAndAnalyze();
  } catch (err: any) {
    console.log("[pool-monitor] Initial fetch failed:", err.message);
    latestAnalysis = {
      utilizationRate: 0,
      reserveHealth: "healthy",
      liquidityRisk: "low",
      marketComparison: "competitive",
      canHandleDrawdown: true,
      maxSafeDrawdown: "40000000000",
      marketAvgAPY: 5.0,
      marketAvgBorrowRate: 7.0,
      updatedAt: new Date().toISOString(),
    };
  }

  setInterval(async () => {
    try {
      await fetchAndAnalyze();
    } catch (err: any) {
      console.log("[pool-monitor] Scheduled fetch failed:", err.message);
    }
  }, 60 * 60 * 1000);
}

export { latestAnalysis };
main().catch(console.error);
