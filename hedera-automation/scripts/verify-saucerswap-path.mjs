/**
 * Prove SaucerSwap V2 swap path availability on Hedera testnet.
 * Run: node hedera-automation/scripts/verify-saucerswap-path.mjs
 */
import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
const FACTORY = process.env.SAUCERSWAP_FACTORY_EVM || "0x00000000000000000000000000000000001243ee";
const SS_USDC = process.env.SAUCERSWAP_USDC_EVM || "0x0000000000000000000000000000000000001549";
const SS_WHBAR = process.env.SAUCERSWAP_WHBAR_EVM || "0x0000000000000000000000000000000000003ad2";
const POOL_WHBAR = process.env.WHBAR_ADDRESS || "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed";
const CIRCLE_USDC = process.env.USDC_EVM_ADDRESS || "0x0000000000000000000000000000000000068cda";
const ROUTER_EVM = process.env.SAUCERSWAP_ROUTER_EVM || "0x0000000000000000000000000000000000159398";
const QUOTER = process.env.SAUCERSWAP_QUOTER_EVM || "0x00000000000000000000000000000000001535b2";
const FEE = parseInt(process.env.SAUCERSWAP_POOL_FEE || "3000", 10);

const provider = new ethers.JsonRpcProvider(RPC, 296, { batchMaxCount: 1 });
const factory = new ethers.Contract(FACTORY, ["function getPool(address,address,uint24) view returns (address)"], provider);
const quoterIface = new ethers.Interface([
  "function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)",
]);

async function poolFor(a, b, label) {
  const p = await factory.getPool(a, b, FEE);
  const ok = p !== ethers.ZeroAddress;
  console.log(`${ok ? "PASS" : "FAIL"}: ${label} pool = ${p}`);
  return ok;
}

async function quoteUsdcWhbar() {
  const feeHex = FEE.toString(16).padStart(6, "0");
  const pathHex = "0x" + SS_USDC.slice(2).toLowerCase() + feeHex + SS_WHBAR.slice(2).toLowerCase();
  const data = quoterIface.encodeFunctionData("quoteExactInput", [pathHex, 1_000_000n]);
  const result = await provider.call({ to: QUOTER, data });
  const decoded = quoterIface.decodeFunctionResult("quoteExactInput", result);
  console.log(`PASS: SS_USDC->SS_WHBAR quote 1 USDC = ${decoded[0]} WHBAR units`);
}

console.log("SaucerSwap path verification (Hedera testnet)");
console.log("Router EVM:", ROUTER_EVM);
await poolFor(SS_USDC, SS_WHBAR, "SS_USDC/SS_WHBAR");
await poolFor(SS_USDC, POOL_WHBAR, "SS_USDC/POOL_WHBAR (expected none)");
await poolFor(CIRCLE_USDC, SS_WHBAR, "Circle_USDC/SS_WHBAR (expected none)");
await quoteUsdcWhbar();
console.log("Note: on-chain swaps require SAUCERSWAP_EXECUTE_SWAPS=true + SaucerSwap USDC balance + router allowance");
