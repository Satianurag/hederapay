/**
 * Convert Hedera contract/token id (e.g. 0.0.1414040) to EVM address for JSON-RPC calls.
 */
export function hederaIdToEvmAddress(hederaId: string): string {
  const num = hederaId.replace(/^0\.0\./, "");
  const hex = BigInt(num).toString(16);
  return `0x${hex.padStart(40, "0")}`;
}

/** SaucerSwap V2 SwapRouter on Hedera testnet (0.0.1414040) */
export const SAUCERSWAP_ROUTER_EVM_TESTNET = hederaIdToEvmAddress("0.0.1414040");
