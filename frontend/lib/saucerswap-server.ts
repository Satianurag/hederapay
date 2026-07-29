import { ethers } from "ethers";

const HEDERA_RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
const HEDERA_CHAIN_ID = 296;
const SAUCERSWAP_USDC_EVM =
  process.env.SAUCERSWAP_USDC_EVM || "0x0000000000000000000000000000000000001549";
const SAUCERSWAP_WHBAR_EVM =
  process.env.SAUCERSWAP_WHBAR_EVM || "0x0000000000000000000000000000000000003ad2";
const SAUCERSWAP_QUOTER_EVM = process.env.SAUCERSWAP_QUOTER_EVM || "0x00000000000000000000000000000000001535b2";
const SAUCERSWAP_FACTORY_EVM =
  process.env.SAUCERSWAP_FACTORY_EVM || "0x00000000000000000000000000000000001243ee";
const SAUCERSWAP_POOL_FEE = parseInt(process.env.SAUCERSWAP_POOL_FEE || "3000", 10);

const QUOTER_ABI = [
  "function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)",
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
] as const;

const FACTORY_ABI = [
  "function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)",
] as const;

const TOKENS: Record<string, { address: string; decimals: number }> = {
  WHBAR: { address: SAUCERSWAP_WHBAR_EVM, decimals: 8 },
  HBAR: { address: SAUCERSWAP_WHBAR_EVM, decimals: 8 },
  USDC: { address: SAUCERSWAP_USDC_EVM, decimals: 6 },
};

function getProvider() {
  return new ethers.JsonRpcProvider(HEDERA_RPC_URL, HEDERA_CHAIN_ID, { batchMaxCount: 1 });
}

function encodePath(tokenIn: string, tokenOut: string, fee: number): string {
  const feeHex = fee.toString(16).padStart(6, "0");
  return tokenIn.slice(2).toLowerCase() + feeHex + tokenOut.slice(2).toLowerCase();
}

export async function quoteExactIn(tokenIn: string, tokenOut: string, amountIn: string) {
  const provider = getProvider();
  const iface = new ethers.Interface(QUOTER_ABI);
  const pathHex = encodePath(tokenIn, tokenOut, SAUCERSWAP_POOL_FEE);
  const data = iface.encodeFunctionData("quoteExactInput", ["0x" + pathHex, amountIn]);

  try {
    const result = await provider.call({ to: SAUCERSWAP_QUOTER_EVM, data });
    const decoded = iface.decodeFunctionResult("quoteExactInput", result);
    return {
      amountOut: decoded[0].toString(),
      gasEstimate: decoded[3]?.toString?.() || "0",
    };
  } catch {
    const quoter = new ethers.Contract(SAUCERSWAP_QUOTER_EVM, QUOTER_ABI, provider);
    const result = await quoter.quoteExactInputSingle.staticCall({
      tokenIn,
      tokenOut,
      amountIn,
      fee: SAUCERSWAP_POOL_FEE,
      sqrtPriceLimitX96: 0,
    });
    return {
      amountOut: result[0].toString(),
      gasEstimate: result[3]?.toString?.() || "0",
    };
  }
}

async function getPoolAddress(tokenA: string, tokenB: string) {
  const provider = getProvider();
  const factory = new ethers.Contract(SAUCERSWAP_FACTORY_EVM, FACTORY_ABI, provider);
  return factory.getPool(tokenA, tokenB, SAUCERSWAP_POOL_FEE);
}

export async function getSaucerSwapRates() {
  const rates: Record<string, { rate: number; inputAmount: string; outputAmount: string; pool?: string }> = {};
  const pairs = [{ from: "USDC", to: "WHBAR", amount: "1000000" }];
  const pool = await getPoolAddress(SAUCERSWAP_USDC_EVM, SAUCERSWAP_WHBAR_EVM);

  for (const pair of pairs) {
    const from = TOKENS[pair.from];
    const to = TOKENS[pair.to];
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
    network: process.env.HEDERA_NETWORK || "hedera:testnet",
    quoter: process.env.SAUCERSWAP_V2_QUOTER || "0.0.1390002",
    pool: pool !== ethers.ZeroAddress ? pool : null,
    timestamp: new Date().toISOString(),
  };
}

export async function getSaucerSwapQuote(tokenIn: string, tokenOut: string, amount: string) {
  const from = TOKENS[tokenIn];
  const to = TOKENS[tokenOut];
  if (!from || !to) {
    throw new Error("Invalid token pair");
  }
  const quote = await quoteExactIn(from.address, to.address, amount);
  return {
    input: { token: tokenIn, amount },
    output: { token: tokenOut, amount: quote.amountOut },
    gasEstimate: quote.gasEstimate,
    source: "SaucerSwap V2 QuoterV2",
    network: process.env.HEDERA_NETWORK || "hedera:testnet",
  };
}

export { TOKENS };
