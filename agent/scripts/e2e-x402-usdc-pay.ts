/**
 * Live x402 USDC E2E — pays market-data endpoint with Circle USDC on Hedera testnet.
 * Requires: data service running, USDC associated + funded buyer account.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const serverUrl = process.env.AGENT_DATA_SERVICE_URL || "http://localhost:4001";
const url = `${serverUrl}/api/agent/market-data`;

const keyType = (process.env.HEDERA_KEY_TYPE || "ecdsa").toLowerCase();
const rawKey = process.env.HEDERA_CLIENT_KEY || process.env.AGENT_PRIVATE_KEY || "";
const accountId = process.env.HEDERA_CLIENT_ID || process.env.HEDERA_ACCOUNT_ID || "";
const privateKey =
  keyType === "ed25519"
    ? PrivateKey.fromStringED25519(rawKey)
    : PrivateKey.fromStringECDSA(rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`);

const signer = createClientHederaSigner(accountId, privateKey, {
  network: (process.env.HEDERA_NETWORK || "hedera:testnet") as "hedera:testnet",
});
const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const httpClient = new x402HTTPClient(client);

console.log(`-> GET ${url} (0.001 USDC only)`);
let res: Response;
try {
  res = await fetchWithPayment(url);
} catch (err: any) {
  throw new Error(
    `x402 USDC payment failed: ${err.message}. Associate USDC (npm run associate-usdc) and fund via https://faucet.circle.com`
  );
}
console.log(`<- HTTP ${res.status}`);

if (!res.ok) {
  const text = await res.text();
  throw new Error(
    `Request failed (${res.status}): ${text || "no body"}. Fund buyer with testnet USDC via https://faucet.circle.com`
  );
}

const body = await res.json();
console.log("data keys:", Object.keys(body).join(", "));

const settlement = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
if (!settlement?.transaction) {
  throw new Error("No x402 settlement transaction in response");
}

console.log("\n✅ x402 USDC settlement:");
console.log("  success:    ", settlement.success);
console.log("  payer:      ", settlement.payer);
console.log("  transaction:", settlement.transaction);
console.log("  HashScan:   ", `https://hashscan.io/testnet/transaction/${settlement.transaction}`);
