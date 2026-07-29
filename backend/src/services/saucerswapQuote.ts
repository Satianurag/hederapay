import { ethers } from "ethers";
import { env } from "../config/env";

/**
 * SaucerSwap V2 quote service — follows official docs:
 * @see https://docs.saucerswap.finance/v/developer/saucerswap-v2/swap-operations/swap-quote
 * Uses ethers v6 JsonRpcProvider with batchMaxCount: 1 (Hedera relay workaround).
 */

const QUOTER_ABI = [
  "function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)",
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
] as const;

const FACTORY_ABI = [
  "function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)",
] as const;

export const SAUCERSWAP_TOKENS: Record<string, { address: string; decimals: number }> = {
  WHBAR: { address: env.SAUCERSWAP_WHBAR_EVM, decimals: 8 },
  HBAR: { address: env.SAUCERSWAP_WHBAR_EVM, decimals: 8 },
  /** SaucerSwap pool USDC (0.0.5449) — has USDC/WHBAR liquidity on testnet */
  USDC: { address: env.SAUCERSWAP_USDC_EVM, decimals: 6 },
};

const DEFAULT_FEE = env.SAUCERSWAP_POOL_FEE;

function getProvider() {
  return new ethers.JsonRpcProvider(env.HEDERA_RPC_URL, env.HEDERA_CHAIN_ID, {
    batchMaxCount: 1,
  });
}

function getQuoterEvmAddress() {
  const quoterEvm = process.env.SAUCERSWAP_QUOTER_EVM;
  if (!quoterEvm) {
    throw new Error("SAUCERSWAP_QUOTER_EVM not set — SaucerSwap QuoterV2 0.0.1390002");
  }
  return quoterEvm;
}

function encodePath(tokenIn: string, tokenOut: string, fee: number): string {
  const feeHex = fee.toString(16).padStart(6, "0");
  return tokenIn.slice(2).toLowerCase() + feeHex + tokenOut.slice(2).toLowerCase();
}

/**
 * Official SaucerSwap pattern: provider.call + quoteExactInput encoded path.
 */
export async function quoteExactIn(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  fee = DEFAULT_FEE
): Promise<{ amountOut: string; gasEstimate: string }> {
  const provider = getProvider();
  const quoterEvm = getQuoterEvmAddress();
  const iface = new ethers.Interface(QUOTER_ABI);

  const pathHex = encodePath(tokenIn, tokenOut, fee);
  const data = iface.encodeFunctionData("quoteExactInput", ["0x" + pathHex, amountIn]);

  try {
    const result = await provider.call({ to: quoterEvm, data });
    const decoded = iface.decodeFunctionResult("quoteExactInput", result);
    return {
      amountOut: decoded[0].toString(),
      gasEstimate: decoded[3]?.toString?.() || "0",
    };
  } catch (pathErr: any) {
    const quoter = new ethers.Contract(quoterEvm, QUOTER_ABI, provider);
    const result = await quoter.quoteExactInputSingle.staticCall({
      tokenIn,
      tokenOut,
      amountIn,
      fee,
      sqrtPriceLimitX96: 0,
    });
    return {
      amountOut: result[0].toString(),
      gasEstimate: result[3]?.toString?.() || "0",
    };
  }
}

export async function getPoolAddress(
  tokenA: string,
  tokenB: string,
  fee = DEFAULT_FEE
): Promise<string> {
  const provider = getProvider();
  const factory = new ethers.Contract(env.SAUCERSWAP_FACTORY_EVM, FACTORY_ABI, provider);
  return factory.getPool(tokenA, tokenB, fee);
}

export async function getSaucerSwapRates() {
  const rates: Record<string, { rate: number; inputAmount: string; outputAmount: string; pool?: string }> = {};
  const pairs = [{ from: "USDC", to: "WHBAR", amount: "1000000" }];

  const usdc = SAUCERSWAP_TOKENS.USDC;
  const whbar = SAUCERSWAP_TOKENS.WHBAR;
  const pool = await getPoolAddress(usdc.address, whbar.address);

  for (const pair of pairs) {
    const from = SAUCERSWAP_TOKENS[pair.from];
    const to = SAUCERSWAP_TOKENS[pair.to];
    if (!from || !to) continue;

    const quote = await quoteExactIn(from.address, to.address, pair.amount);
    const amtIn = Number(pair.amount) / 10 ** from.decimals;
    const amtOut = Number(quote.amountOut) / 10 ** to.decimals;
    rates[`${pair.from}/WHBAR`] = {
      rate: amtIn > 0 ? amtOut / amtIn : 0,
      inputAmount: pair.amount,
      outputAmount: quote.amountOut,
      pool: pool !== ethers.ZeroAddress ? pool : undefined,
    };
  }

  return {
    rates,
    source: "SaucerSwap V2 QuoterV2",
    network: env.HEDERA_NETWORK,
    quoter: env.SAUCERSWAP_V2_QUOTER,
    pool: pool !== ethers.ZeroAddress ? pool : null,
    timestamp: new Date().toISOString(),
  };
}

export async function getSaucerSwapQuote(tokenIn: string, tokenOut: string, amount: string) {
  const from = SAUCERSWAP_TOKENS[tokenIn];
  const to = SAUCERSWAP_TOKENS[tokenOut];
  if (!from || !to) {
    throw new Error(`Invalid token pair: ${tokenIn} -> ${tokenOut}`);
  }

  const quote = await quoteExactIn(from.address, to.address, amount);
  return {
    input: { token: tokenIn, amount },
    output: { token: tokenOut, amount: quote.amountOut },
    gasEstimate: quote.gasEstimate,
    source: "SaucerSwap V2 QuoterV2",
    network: env.HEDERA_NETWORK,
  };
}

export { SAUCERSWAP_TOKENS as TOKENS };
