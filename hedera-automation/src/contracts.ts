import { ethers } from "ethers";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const abiDir = path.resolve(__dirname, "../../backend/src/config");

export function getWalletProvider() {
  if (!config.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY required");
  const provider = new ethers.JsonRpcProvider(config.HEDERA_RPC_URL, config.HEDERA_CHAIN_ID, {
    batchMaxCount: 1,
  });
  return new ethers.Wallet(config.DEPLOYER_PRIVATE_KEY, provider);
}

export function getPoolContract(signer?: ethers.Signer) {
  const abi = JSON.parse(readFileSync(path.join(abiDir, "PoolABI.json"), "utf8"));
  return new ethers.Contract(config.POOL_ADDRESS, abi, signer || getWalletProvider());
}

export function getYieldReserveContract(signer?: ethers.Signer) {
  const abi = JSON.parse(readFileSync(path.join(abiDir, "YieldReserveABI.json"), "utf8"));
  return new ethers.Contract(config.YIELD_RESERVE_ADDRESS, abi, signer || getWalletProvider());
}


export async function getSaucerSwapQuote(tokenIn: string, tokenOut: string, amountIn: bigint) {
  if (!config.SAUCERSWAP_QUOTER_EVM) {
    return { amountOut: amountIn };
  }
  const provider = new ethers.JsonRpcProvider(config.HEDERA_RPC_URL, config.HEDERA_CHAIN_ID, {
    batchMaxCount: 1,
  });
  const iface = new ethers.Interface([
    "function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)",
    "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
  ]);
  const fee = config.SAUCERSWAP_POOL_FEE;
  const feeHex = fee.toString(16).padStart(6, "0");
  const pathHex = tokenIn.slice(2).toLowerCase() + feeHex + tokenOut.slice(2).toLowerCase();
  const data = iface.encodeFunctionData("quoteExactInput", ["0x" + pathHex, amountIn]);

  try {
    const result = await provider.call({ to: config.SAUCERSWAP_QUOTER_EVM, data });
    const decoded = iface.decodeFunctionResult("quoteExactInput", result);
    return { amountOut: decoded[0] as bigint };
  } catch {
    const quoter = new ethers.Contract(config.SAUCERSWAP_QUOTER_EVM, iface.fragments, provider);
    const result = await quoter.quoteExactInputSingle.staticCall({
      tokenIn,
      tokenOut,
      amountIn,
      fee,
      sqrtPriceLimitX96: 0,
    });
    return { amountOut: result[0] as bigint };
  }
}

export {
  getChainlinkHbarUsdSnapshot,
  getChainlinkHbarUsdPrice,
  getChainlinkUsdcUsdPrice,
  validateSwapAgainstChainlink,
  whbarToUsd,
} from "./services/chainlinkPrice.js";
