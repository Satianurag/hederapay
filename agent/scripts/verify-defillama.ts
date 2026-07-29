#!/usr/bin/env -S npx tsx
/**
 * Verify DeFiLlama live market data fetch (Phase 3).
 */
import { fetchDefiLlamaMarketData } from "../src/defillama.js";

async function main() {
  const data = await fetchDefiLlamaMarketData();
  if (data.hbarUsdRate <= 0) throw new Error("Invalid HBAR price");
  if (data.hederaDefiTvlUsd <= 0) throw new Error("Invalid Hedera TVL");
  if (data.averageLendingAPY <= 0) throw new Error("Invalid lending APY");

  console.log("PASS: DeFiLlama market data");
  console.log("  HBAR/USD:", data.hbarUsdRate);
  console.log("  Hedera DeFi TVL USD:", Math.round(data.hederaDefiTvlUsd));
  console.log("  SaucerSwap TVL USD:", Math.round(data.saucerSwapTvlUsd));
  console.log("  Avg lending APY:", data.averageLendingAPY);
  console.log("  Hedera yield pools:", data.hederaYieldPoolCount);
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
