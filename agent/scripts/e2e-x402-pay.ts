/**
 * Live x402 E2E — pays a Data Service endpoint on Hedera testnet via blocky402.
 * Pattern from https://github.com/matevszm/x402-hedera-example (scripts/e2e-pay.ts)
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
const endpoint = process.env.E2E_ENDPOINT || "/api/agent/credit-score?pspAddress=0xTestPSP";
const url = `${serverUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

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

console.log(`-> GET ${url}`);
const res = await fetchWithPayment(url);
console.log(`<- HTTP ${res.status}`);

const body = await res.json();
console.log("data:", JSON.stringify(body, null, 2));

try {
  const settlement = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
  if (settlement?.transaction) {
    console.log("\n✅ x402 settlement:");
    console.log("  success:    ", settlement.success);
    console.log("  payer:      ", settlement.payer);
    console.log("  transaction:", settlement.transaction);
    console.log("  HashScan:   ", `https://hashscan.io/testnet/transaction/${settlement.transaction}`);
  } else {
    console.log("\n⚠️  No transaction in settlement response");
  }
} catch {
  console.log("\n⚠️  No payment-response header");
}
