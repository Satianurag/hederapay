/**
 * Official Hedera testnet token IDs (Circle USDC, SaucerSwap WHBAR).
 * @see https://developers.circle.com/stablecoins/usdc-contract-addresses
 * @see https://docs.saucerswap.finance/developerx/contract-deployments
 */

/** SaucerSwap V2 Factory on Hedera testnet (0.0.1197038) */
export const SAUCERSWAP_FACTORY_EVM_ADDRESS =
  "0x00000000000000000000000000000000001243ee" as const;

/** SaucerSwap V2 QuoterV2 on Hedera testnet (0.0.1390002) */
export const SAUCERSWAP_QUOTER_EVM_ADDRESS =
  "0x00000000000000000000000000000000001535b2" as const;

/** Default USDC/WHBAR pool fee tier (0.30%) */
export const SAUCERSWAP_DEFAULT_FEE = 3000;

/** Circle official USDC on Hedera testnet (6 decimals) */
export const CIRCLE_USDC_TOKEN_ID = "0.0.429274";
export const CIRCLE_USDC_EVM_ADDRESS =
  "0x0000000000000000000000000000000000068cda" as const;
export const CIRCLE_USDC_DECIMALS = 6;

/** SaucerSwap pool USDC on testnet — used for DEX quotes (6 decimals) */
export const SAUCERSWAP_USDC_TOKEN_ID = "0.0.5449";
export const SAUCERSWAP_USDC_EVM_ADDRESS =
  "0x0000000000000000000000000000000000001549" as const;

/** SaucerSwap pool WHBAR token (0.0.15058) — DEX liquidity token */
export const SAUCERSWAP_WHBAR_TOKEN_ID = "0.0.15058";
export const SAUCERSWAP_WHBAR_EVM_ADDRESS =
  "0x0000000000000000000000000000000000003ad2" as const;

/** New WHBAR contract used by HederaPay pool deposits (8 decimals) */
export const POOL_WHBAR_EVM_ADDRESS =
  "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed" as const;
export const POOL_WHBAR_DECIMALS = 8;
