#!/usr/bin/env node
/**
 * Verify Chainlink HBAR/USD feed on Hedera testnet (AggregatorV3Interface).
 */
import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const feed = process.env.CHAINLINK_HBAR_USD_FEED || "0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a";
const rpc = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
const abi = [
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(rpc, 296, { batchMaxCount: 1 });
  const c = new ethers.Contract(feed, abi, provider);
  const [dec, desc, round] = await Promise.all([c.decimals(), c.description(), c.latestRoundData()]);
  const answer = round[1];
  const price = Number(answer) / 10 ** Number(dec);

  if (price <= 0) throw new Error("Invalid Chainlink price");

  console.log("PASS: Chainlink HBAR/USD");
  console.log("  Feed:", feed);
  console.log("  Description:", desc);
  console.log("  Price USD:", price.toFixed(6));
  console.log("  Updated:", new Date(Number(round[3]) * 1000).toISOString());
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
