import { ethers } from "ethers";
import { config } from "../config.js";

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
];

function getReadProvider() {
  return new ethers.JsonRpcProvider(config.HEDERA_RPC_URL, config.HEDERA_CHAIN_ID, {
    batchMaxCount: 1,
  });
}

export async function getChainlinkHbarUsdSnapshot(): Promise<HbarUsdOracleSnapshot> {
  const provider = getReadProvider();
  const feed = new ethers.Contract(config.CHAINLINK_HBAR_USD_FEED, PRICE_FEED_ABI, provider);
  const [decimals, description, round] = await Promise.all([
    feed.decimals(),
    feed.description().catch(() => "HBAR / USD"),
    feed.latestRoundData(),
  ]);

  const answer = round[1] as bigint;
  const updatedAt = Number(round[3]);
  const maxStalenessSec = config.CHAINLINK_MAX_STALENESS_SEC;
  const nowSec = Math.floor(Date.now() / 1000);
  const dec = Number(decimals);

  return {
    feedAddress: config.CHAINLINK_HBAR_USD_FEED,
    answer,
    decimals: dec,
    priceUsd: formatHbarUsdPrice(answer, dec),
    updatedAt,
    stale: nowSec - updatedAt > maxStalenessSec,
    maxStalenessSec,
    description,
  };
}

/** @deprecated use getChainlinkHbarUsdSnapshot */
export async function getChainlinkHbarUsdPrice(): Promise<bigint> {
  const snap = await getChainlinkHbarUsdSnapshot();
  return snap.answer;
}

export const getChainlinkUsdcUsdPrice = getChainlinkHbarUsdPrice;

export function validateSwapAgainstChainlink(
  usdcIn: bigint,
  whbarOut: bigint,
  oracle: HbarUsdOracleSnapshot,
  toleranceBps = config.CHAINLINK_SWAP_TOLERANCE_BPS
): { impliedHbarUsd: number; withinTolerance: boolean } {
  const impliedHbarUsd = impliedHbarUsdFromSwap(usdcIn, whbarOut);
  const withinTolerance = isSwapRateWithinOracleTolerance(impliedHbarUsd, oracle.priceUsd, toleranceBps);
  return { impliedHbarUsd, withinTolerance };
}
