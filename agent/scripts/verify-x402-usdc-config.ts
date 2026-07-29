/**
 * Verify x402 USDC route configuration (no live payment required).
 */
import { hbarPrice, usdcPrice } from "../src/x402Server.js";
import { HEDERA_TESTNET_USDC } from "@x402/hedera";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const hbar = hbarPrice("0.01");
assert(hbar.asset === "0.0.0", "HBAR asset should be 0.0.0");
assert(hbar.amount === "1000000", `HBAR tinybars wrong: ${hbar.amount}`);

const usdc = usdcPrice("0.001");
assert(usdc.asset === HEDERA_TESTNET_USDC || usdc.asset === "0.0.429274", `USDC asset wrong: ${usdc.asset}`);
assert(usdc.amount === "1000", `USDC units wrong: ${usdc.amount}`);

console.log("PASS: x402 USDC route config");
console.log("  HBAR 0.01 →", hbar);
console.log("  USDC 0.001 →", usdc);
