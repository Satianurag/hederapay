/**
 * Chainlink HBAR/USD oracle helpers.
 * @see https://docs.chain.link/data-feeds/api-reference (AggregatorV3Interface)
 */

export const CHAINLINK_HBAR_USD_DECIMALS = 8;
export const DEFAULT_CHAINLINK_MAX_STALENESS_SEC = 86400; // testnet feeds update slowly

export interface HbarUsdOracleSnapshot {
  feedAddress: string;
  answer: bigint;
  decimals: number;
  priceUsd: number;
  updatedAt: number;
  stale: boolean;
  maxStalenessSec: number;
  description?: string;
}

export function formatHbarUsdPrice(answer: bigint, decimals = CHAINLINK_HBAR_USD_DECIMALS): number {
  return Number(answer) / 10 ** decimals;
}

/** WHBAR amount (8 decimals) → USD notional using Chainlink HBAR/USD */
export function whbarToUsd(whbarAmount: bigint, hbarUsdAnswer: bigint, decimals = CHAINLINK_HBAR_USD_DECIMALS): number {
  return (Number(whbarAmount) * Number(hbarUsdAnswer)) / 10 ** (8 + decimals);
}

/** USDC amount (6 decimals) → implied HBAR/USD if swapped to whbarOut (8 decimals) */
export function impliedHbarUsdFromSwap(usdcIn: bigint, whbarOut: bigint): number {
  if (whbarOut === 0n) return 0;
  const usd = Number(usdcIn) / 1e6;
  const hbar = Number(whbarOut) / 1e8;
  return usd / hbar;
}

/** Returns true if implied rate is within toleranceBps of Chainlink HBAR/USD */
export function isSwapRateWithinOracleTolerance(
  impliedHbarUsd: number,
  chainlinkPriceUsd: number,
  toleranceBps = 200
): boolean {
  if (chainlinkPriceUsd <= 0 || impliedHbarUsd <= 0) return false;
  const diff = Math.abs(impliedHbarUsd - chainlinkPriceUsd);
  const maxDiff = (chainlinkPriceUsd * toleranceBps) / 10_000;
  return diff <= maxDiff;
}
