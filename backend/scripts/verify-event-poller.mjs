#!/usr/bin/env node
/**
 * Verify Pool event polling via eth_getLogs (no eth_newFilter).
 */
import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const pool = process.env.POOL_CONTRACT_ADDRESS;
const rpc = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
const abi = JSON.parse(readFileSync(path.resolve(__dirname, "../src/config/PoolABI.json"), "utf8"));

async function main() {
  const provider = new ethers.JsonRpcProvider(rpc, 296, { batchMaxCount: 1 });
  const contract = new ethers.Contract(pool, abi, provider);
  const block = await provider.getBlockNumber();

  const events = ["Deposited", "DrawdownExecuted", "LiquidityShortfall", "RepaymentReceived"];
  let total = 0;
  for (const name of events) {
    const logs = await contract.queryFilter(name, block - 8000, block);
    console.log(`  ${name}: ${logs.length} log(s)`);
    total += logs.length;
  }

  console.log("PASS: eth_getLogs polling works, total logs:", total);
  console.log("  (no eth_newFilter — HashIO compatible)");
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
