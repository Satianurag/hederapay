import { hederaTestnet } from "viem/chains";

export { hederaTestnet };

/** Native HBAR asset id for x402 */
export const HBAR_ASSET_ID = "0.0.0" as const;

/** WHBAR — pool base asset on Hedera testnet (8 decimals) */
export const WHBAR_ADDRESS =
  "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed" as const;

/** Circle official USDC on Hedera testnet (6 decimals) — secondary repayment token */
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x0000000000000000000000000000000000068cda") as `0x${string}`;

export const POOL_ADDRESS = (process.env.NEXT_PUBLIC_POOL_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const YIELD_RESERVE_ADDRESS = (process.env.NEXT_PUBLIC_YIELD_RESERVE_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const HASHSCAN_BASE = "https://hashscan.io/testnet";

export const SAUCERSWAP_V2_ROUTER = "0.0.1414040";
export const SAUCERSWAP_V2_QUOTER = "0.0.1390002";
export const CHAINLINK_HBAR_USD_FEED = "0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a";

export const WHBAR_DECIMALS = 8;
export const USDC_DECIMALS = 6;

/** @deprecated use WHBAR_DECIMALS */
export const TOKEN_DECIMALS = WHBAR_DECIMALS;
