import { ethers } from "ethers";
import { env } from "../config/env";

const CHAINLINK_HBAR_USD_DECIMALS = 8;

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

function formatHbarUsdPrice(answer: bigint, decimals = CHAINLINK_HBAR_USD_DECIMALS): number {
  return Number(answer) / 10 ** decimals;
}

export function whbarToUsd(whbarAmount: bigint, hbarUsdAnswer: bigint, decimals = CHAINLINK_HBAR_USD_DECIMALS): number {
  return (Number(whbarAmount) * Number(hbarUsdAnswer)) / 10 ** (8 + decimals);
}

export function impliedHbarUsdFromSwap(usdcIn: bigint, whbarOut: bigint): number {
  if (whbarOut === 0n) return 0;
  const usd = Number(usdcIn) / 1e6;
  const hbar = Number(whbarOut) / 1e8;
  return usd / hbar;
}

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

const PRICE_FEED_ABI = [
  "function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
] as const;

function getProvider() {
  return new ethers.JsonRpcProvider(env.HEDERA_RPC_URL, env.HEDERA_CHAIN_ID, {
    batchMaxCount: 1,
  });
}

export async function fetchHbarUsdOracle(): Promise<HbarUsdOracleSnapshot> {
  const provider = getProvider();
  const feed = new ethers.Contract(env.CHAINLINK_HBAR_USD_FEED, PRICE_FEED_ABI, provider);
  const [decimals, description, round] = await Promise.all([
    feed.decimals(),
    feed.description().catch(() => "HBAR / USD"),
    feed.latestRoundData(),
  ]);

  const answer = round[1] as bigint;
  const updatedAt = Number(round[3]);
  const maxStalenessSec = env.CHAINLINK_MAX_STALENESS_SEC;
  const nowSec = Math.floor(Date.now() / 1000);
  const dec = Number(decimals);

  return {
    feedAddress: env.CHAINLINK_HBAR_USD_FEED,
    answer,
    decimals: dec,
    priceUsd: formatHbarUsdPrice(answer, dec),
    updatedAt,
    stale: nowSec - updatedAt > maxStalenessSec,
    maxStalenessSec,
    description,
  };
}

export async function fetchPoolOnChainOracle(): Promise<{ price: bigint; updatedAt: bigint } | null> {
  if (!env.POOL_CONTRACT_ADDRESS) return null;
  const poolAbi = ["function getLatestPrice() view returns (int256 price, uint256 updatedAt)"];
  const provider = getProvider();
  const pool = new ethers.Contract(env.POOL_CONTRACT_ADDRESS, poolAbi, provider);
  try {
    const [price, updatedAt] = await pool.getLatestPrice();
    return { price, updatedAt };
  } catch {
    return null;
  }
}

export { CHAINLINK_HBAR_USD_DECIMALS };
