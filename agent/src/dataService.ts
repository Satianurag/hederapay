import express from "express";
import { config } from "./agentClient.js";
import { mountPaidRoutes } from "./x402Server.js";
import { fetchDefiLlamaMarketData } from "./defillama.js";

const app = express();
const PORT = parseInt(process.env.DATA_SERVICE_PORT || process.env.PORT || "4001", 10);

let cachedMarketData: Awaited<ReturnType<typeof fetchDefiLlamaMarketData>> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * External Data Service — Sell Side
 * x402-protected endpoints settle native HBAR on Hedera testnet via @x402/hedera.
 */
mountPaidRoutes(app, {
  "GET /api/agent/credit-score": {
    priceHbar: "0.01",
    description: "PSP credit score assessment",
  },
  "GET /api/agent/compliance-check": {
    priceHbar: "0.005",
    description: "KYB/sanctions compliance screening",
  },
  "GET /api/agent/market-data": {
    priceUsdc: "0.001",
    description: "Stablecoin market data feed (Circle USDC)",
  },
});

app.get("/api/agent/credit-score", (req, res) => {
  const pspAddress = (req.query.pspAddress as string) || "unknown";

  const hash = simpleHash(pspAddress);
  const score = 55 + (hash % 40);
  const factors =
    score >= 80
      ? ["strong payment history", "high transaction volume", "tier-1 banking partners"]
      : score >= 65
        ? ["adequate payment history", "moderate volume", "standard banking partners"]
        : ["limited history", "low volume", "unrated partners"];

  console.log(`[credit-score] Paid request | PSP: ${pspAddress} | Score: ${score}`);

  res.json({
    pspAddress,
    score,
    maxScore: 100,
    factors,
    financialHealth: score >= 80 ? "strong" : score >= 65 ? "adequate" : "weak",
    dataSource: "HederaPay Credit Bureau (simulated)",
    network: config.HEDERA_NETWORK,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/agent/compliance-check", (req, res) => {
  const pspAddress = (req.query.pspAddress as string) || "unknown";
  const hash = simpleHash(pspAddress);
  const sanctionsHit = hash % 20 === 0;
  const pepHit = hash % 50 === 0;
  const status = sanctionsHit ? "fail" : pepHit ? "review" : "pass";

  console.log(`[compliance] Paid request | PSP: ${pspAddress} | Status: ${status}`);

  res.json({
    pspAddress,
    status,
    sanctions: sanctionsHit,
    pep: pepHit,
    adverseMedia: false,
    jurisdiction: "cleared",
    screeningProvider: "ComplyAdvantage (simulated)",
    network: config.HEDERA_NETWORK,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/agent/market-data", async (_req, res) => {
  console.log("[market-data] Paid request");

  try {
    const now = Date.now();
    if (!cachedMarketData || now > cacheExpiresAt) {
      cachedMarketData = await fetchDefiLlamaMarketData();
      cacheExpiresAt = now + CACHE_TTL_MS;
    }

    const market = cachedMarketData;
    res.json({
      hbarTotalLiquidity: Math.round(market.hederaDefiTvlUsd).toString(),
      averagePoolUtilization: market.averagePoolUtilization,
      hbarUsdRate: market.hbarUsdRate,
      averageLendingAPY: market.averageLendingAPY,
      averageBorrowRate: market.averageBorrowRate,
      saucerSwapTvlUsd: market.saucerSwapTvlUsd,
      hederaDexVolume24hUsd: market.hederaDexVolume24hUsd,
      hederaYieldPoolCount: market.hederaYieldPoolCount,
      borrowRateNote: "estimated at 1.25x average Hedera lending APY",
      dataSource: market.dataSource,
      sources: market.sources,
      network: config.HEDERA_NETWORK,
      timestamp: market.timestamp,
    });
  } catch (err: any) {
    console.error("[market-data] DeFiLlama fetch failed:", err.message);
    res.status(502).json({
      error: "Failed to fetch market data from DeFiLlama",
      detail: err.message,
      network: config.HEDERA_NETWORK,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/agent/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "HederaPay Data Service",
    network: config.HEDERA_NETWORK,
    facilitator: config.FACILITATOR_URL,
    seller: config.SELLER_ACCOUNT_ID,
    port: PORT,
  });
});

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

app.listen(PORT, () => {
  console.log(`Data Service running on port ${PORT}`);
  console.log(`  Network: ${config.HEDERA_NETWORK}`);
  console.log(`  Seller:  ${config.SELLER_ACCOUNT_ID}`);
  console.log(`  Facilitator: ${config.FACILITATOR_URL}`);
  console.log("  Endpoints:");
  console.log("    GET /api/agent/credit-score     (0.01 HBAR)");
  console.log("    GET /api/agent/compliance-check (0.005 HBAR)");
  console.log("    GET /api/agent/market-data      (0.001 USDC)");
});
