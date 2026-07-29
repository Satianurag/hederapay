#!/usr/bin/env node
/**
 * Live SaucerSwap USDC/WHBAR quote verification on Hedera testnet.
 * Pattern from https://docs.saucerswap.finance/v/developer/saucerswap-v2/swap-operations/swap-quote
 */
import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const rpc = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
const USDC = process.env.SAUCERSWAP_USDC_EVM || "0x0000000000000000000000000000000000001549";
const WHBAR = process.env.SAUCERSWAP_WHBAR_EVM || "0x0000000000000000000000000000000000003ad2";
const QUOTER = process.env.SAUCERSWAP_QUOTER_EVM || "0x00000000000000000000000000000000001535b2";
const FACTORY = process.env.SAUCERSWAP_FACTORY_EVM || "0x00000000000000000000000000000000001243ee";
const FEE = parseInt(process.env.SAUCERSWAP_POOL_FEE || "3000", 10);

const provider = new ethers.JsonRpcProvider(rpc, 296, { batchMaxCount: 1 });
const factoryAbi = ["function getPool(address,address,uint24) view returns (address)"];
const quoterIface = new ethers.Interface([
  "function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)",
]);

async function main() {
  const factory = new ethers.Contract(FACTORY, factoryAbi, provider);
  const pool = await factory.getPool(USDC, WHBAR, FEE);
  if (pool === ethers.ZeroAddress) {
    console.error("FAIL: No USDC/WHBAR pool at fee", FEE);
    process.exit(1);
  }
  console.log("Pool:", pool);

  const amountIn = "1000000";
  const feeHex = FEE.toString(16).padStart(6, "0");
  const pathHex = USDC.slice(2) + feeHex + WHBAR.slice(2);
  const data = quoterIface.encodeFunctionData("quoteExactInput", ["0x" + pathHex, amountIn]);
  const raw = await provider.call({ to: QUOTER, data });
  const decoded = quoterIface.decodeFunctionResult("quoteExactInput", raw);
  const amountOut = decoded[0];
  const rate = Number(amountOut) / 1e8;

  if (rate <= 0) {
    console.error("FAIL: Zero quote rate");
    process.exit(1);
  }

  console.log("PASS: 1 USDC ->", rate.toFixed(6), "WHBAR");
  console.log("Raw amountOut:", amountOut.toString());
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
