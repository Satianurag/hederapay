/**
 * Chainlink HBAR/USD oracle helpers.
 * @see https://docs.chain.link/data-feeds/api-reference (AggregatorV3Interface)
 */
export declare const CHAINLINK_HBAR_USD_DECIMALS = 8;
export declare const DEFAULT_CHAINLINK_MAX_STALENESS_SEC = 86400;
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
export declare function formatHbarUsdPrice(answer: bigint, decimals?: number): number;
/** WHBAR amount (8 decimals) → USD notional using Chainlink HBAR/USD */
export declare function whbarToUsd(whbarAmount: bigint, hbarUsdAnswer: bigint, decimals?: number): number;
/** USDC amount (6 decimals) → implied HBAR/USD if swapped to whbarOut (8 decimals) */
export declare function impliedHbarUsdFromSwap(usdcIn: bigint, whbarOut: bigint): number;
/** Returns true if implied rate is within toleranceBps of Chainlink HBAR/USD */
export declare function isSwapRateWithinOracleTolerance(impliedHbarUsd: number, chainlinkPriceUsd: number, toleranceBps?: number): boolean;
//# sourceMappingURL=chainlink-hbar.d.ts.map