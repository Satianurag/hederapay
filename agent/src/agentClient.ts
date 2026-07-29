import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  /** x402 buyer account (pays for API calls) */
  HEDERA_CLIENT_ID: process.env.HEDERA_CLIENT_ID || process.env.HEDERA_ACCOUNT_ID || "",
  HEDERA_CLIENT_KEY: process.env.HEDERA_CLIENT_KEY || process.env.AGENT_PRIVATE_KEY || "",
  HEDERA_ACCOUNT_ID: process.env.HEDERA_ACCOUNT_ID || "",
  AGENT_PRIVATE_KEY: process.env.AGENT_PRIVATE_KEY || process.env.HEDERA_CLIENT_KEY || "",
  HEDERA_NETWORK: (process.env.HEDERA_NETWORK || "hedera:testnet") as "hedera:testnet" | "hedera:mainnet",
  SELLER_ACCOUNT_ID: process.env.SELLER_ACCOUNT_ID || process.env.SELLER_WALLET_ADDRESS || "",
  FACILITATOR_URL: process.env.X402_FACILITATOR_URL || "https://api.testnet.blocky402.com",
  DATA_SERVICE_URL: process.env.AGENT_DATA_SERVICE_URL || "http://localhost:4001",
  POOL_MONITOR_URL: process.env.POOL_MONITOR_URL || "http://localhost:4002",
};

function parseAgentKey(raw: string) {
  const keyType = (process.env.HEDERA_KEY_TYPE || "ecdsa").toLowerCase();
  if (keyType === "ed25519") {
    return PrivateKey.fromStringED25519(raw);
  }
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return PrivateKey.fromStringECDSA(key);
}

export interface PaymentResult<T = unknown> {
  data: T;
  settlement?: {
    success?: boolean;
    transaction?: string;
    payer?: string;
    hashscanUrl?: string;
  };
}

/**
 * Create an x402 buyer client using @x402/hedera + @x402/fetch (official Hedera x402 rail).
 */
export async function createAgentClient(privateKey?: string, accountId?: string) {
  const id = accountId || config.HEDERA_CLIENT_ID;
  const key = privateKey || config.HEDERA_CLIENT_KEY;
  if (!id || !key) {
    throw new Error("HEDERA_CLIENT_ID and HEDERA_CLIENT_KEY must be set for x402 buyer");
  }

  const signer = createClientHederaSigner(id, parseAgentKey(key), {
    network: config.HEDERA_NETWORK,
  });

  const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
  const httpClient = new x402HTTPClient(client);
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  return {
    pay: async (url: string): Promise<PaymentResult> => {
      const response = await fetchWithPayment(url);
      const data = await response.json();
      let settlement: ReturnType<x402HTTPClient["getPaymentSettleResponse"]> | undefined;
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
              hashscanUrl: tx
                ? `https://hashscan.io/testnet/transaction/${tx}`
                : undefined,
            }
          : undefined,
      };
    },
  };
}
