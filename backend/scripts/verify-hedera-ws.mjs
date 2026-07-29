#!/usr/bin/env node
/**
 * Verify Hedera WebSocket connectivity (Validation Cloud eth_subscribe).
 * Skips gracefully when HEDERA_WS_URL is not configured.
 */
import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const wsUrl = process.env.HEDERA_WS_URL;

async function main() {
  if (!wsUrl) {
    console.log("SKIP: HEDERA_WS_URL not set (optional — use Validation Cloud wss endpoint)");
    process.exit(0);
  }

  const provider = new ethers.WebSocketProvider(wsUrl, 296, { batchMaxCount: 1 });
  const network = await provider.getNetwork();
  const block = await provider.getBlockNumber();

  console.log("PASS: Hedera WebSocket");
  console.log("  URL:", wsUrl.replace(/\/wss\/[^/]+/, "/wss/<API_KEY>"));
  console.log("  chainId:", network.chainId.toString());
  console.log("  latest block:", block);

  provider.destroy();
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
