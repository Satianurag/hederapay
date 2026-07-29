"use strict";
/**
 * Chainlink HBAR/USD oracle helpers.
 * @see https://docs.chain.link/data-feeds/api-reference (AggregatorV3Interface)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CHAINLINK_MAX_STALENESS_SEC = exports.CHAINLINK_HBAR_USD_DECIMALS = void 0;
exports.formatHbarUsdPrice = formatHbarUsdPrice;
exports.whbarToUsd = whbarToUsd;
exports.impliedHbarUsdFromSwap = impliedHbarUsdFromSwap;
exports.isSwapRateWithinOracleTolerance = isSwapRateWithinOracleTolerance;
exports.CHAINLINK_HBAR_USD_DECIMALS = 8;
exports.DEFAULT_CHAINLINK_MAX_STALENESS_SEC = 86400; // testnet feeds update slowly
function formatHbarUsdPrice(answer, decimals = exports.CHAINLINK_HBAR_USD_DECIMALS) {
    return Number(answer) / 10 ** decimals;
}
/** WHBAR amount (8 decimals) → USD notional using Chainlink HBAR/USD */
function whbarToUsd(whbarAmount, hbarUsdAnswer, decimals = exports.CHAINLINK_HBAR_USD_DECIMALS) {
    return (Number(whbarAmount) * Number(hbarUsdAnswer)) / 10 ** (8 + decimals);
}
/** USDC amount (6 decimals) → implied HBAR/USD if swapped to whbarOut (8 decimals) */
function impliedHbarUsdFromSwap(usdcIn, whbarOut) {
    if (whbarOut === 0n)
        return 0;
    const usd = Number(usdcIn) / 1e6;
    const hbar = Number(whbarOut) / 1e8;
    return usd / hbar;
}
/** Returns true if implied rate is within toleranceBps of Chainlink HBAR/USD */
function isSwapRateWithinOracleTolerance(impliedHbarUsd, chainlinkPriceUsd, toleranceBps = 200) {
    if (chainlinkPriceUsd <= 0 || impliedHbarUsd <= 0)
        return false;
    const diff = Math.abs(impliedHbarUsd - chainlinkPriceUsd);
    const maxDiff = (chainlinkPriceUsd * toleranceBps) / 10000;
    return diff <= maxDiff;
}
//# sourceMappingURL=chainlink-hbar.js.map