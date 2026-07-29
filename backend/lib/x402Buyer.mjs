import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function parseBuyerKey(raw) {
  const keyType = (process.env.HEDERA_KEY_TYPE || "ecdsa").toLowerCase();
  if (keyType === "ed25519") return PrivateKey.fromStringED25519(raw);
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return PrivateKey.fromStringECDSA(key);
}

export async function createX402Buyer() {
  const accountId = process.env.HEDERA_CLIENT_ID || process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_CLIENT_KEY || process.env.AGENT_PRIVATE_KEY;
  if (!accountId || !privateKey) {
    throw new Error("HEDERA_CLIENT_ID and HEDERA_CLIENT_KEY required for x402 credit risk");
  }

  const network = process.env.HEDERA_NETWORK || "hedera:testnet";
  const signer = createClientHederaSigner(accountId, parseBuyerKey(privateKey), { network });
  const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
  const httpClient = new x402HTTPClient(client);
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  return {
    pay: async (url) => {
      const response = await fetchWithPayment(url);
      const data = await response.json();
      let settlement;
      try {
        settlement = httpClient.getPaymentSettleResponse((name) => response.headers.get(name));
      } catch {
        settlement = undefined;
      }
      const tx = settlement?.transaction;
      return {
        data,
        settlement: settlement
          ? {
              success: settlement.success,
              transaction: tx,
              payer: settlement.payer,
              hashscanUrl: tx ? `https://hashscan.io/testnet/transaction/${tx}` : undefined,
            }
          : undefined,
      };
    },
  };
}
