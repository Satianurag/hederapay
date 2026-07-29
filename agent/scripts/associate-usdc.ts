/**
 * Associate Circle USDC (0.0.429274) with buyer/seller accounts for x402 HTS payments.
 * Run once per account before USDC x402 settlement.
 *
 * @see https://docs.hedera.com — TokenAssociateTransaction
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  AccountId,
  Client,
  PrivateKey,
  TokenAssociateTransaction,
  TokenId,
} from "@x402/hedera";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const USDC_TOKEN = process.env.USDC_TOKEN_ADDRESS || "0.0.429274";

function parseKey(raw: string) {
  const keyType = (process.env.HEDERA_KEY_TYPE || "ecdsa").toLowerCase();
  if (keyType === "ed25519") return PrivateKey.fromStringED25519(raw);
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return PrivateKey.fromStringECDSA(key);
}

async function associate(accountId: string, privateKey: string, label: string) {
  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(accountId), parseKey(privateKey));

  console.log(`Associating USDC ${USDC_TOKEN} with ${label} (${accountId})...`);
  const tx = await new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(accountId))
    .setTokenIds([TokenId.fromString(USDC_TOKEN)])
    .execute(client);

  const receipt = await tx.getReceipt(client);
  console.log(`  Status: ${receipt.status.toString()}`);
  console.log(`  HashScan: https://hashscan.io/testnet/transaction/${tx.transactionId.toString()}`);
  client.close();
}

async function main() {
  const buyerId = process.env.HEDERA_CLIENT_ID || process.env.HEDERA_ACCOUNT_ID;
  const buyerKey = process.env.HEDERA_CLIENT_KEY || process.env.AGENT_PRIVATE_KEY;
  const sellerId = process.env.SELLER_ACCOUNT_ID || process.env.SELLER_WALLET_ADDRESS;
  const sellerKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.OPERATOR_KEY;

  if (!buyerId || !buyerKey) {
    throw new Error("HEDERA_CLIENT_ID and HEDERA_CLIENT_KEY required for buyer association");
  }

  await associate(buyerId, buyerKey, "x402 buyer");

  if (sellerId && sellerKey && sellerId !== buyerId) {
    try {
      await associate(sellerId, sellerKey.replace(/^0x/, ""), "x402 seller");
    } catch (err: any) {
      console.log("Seller association skipped or already associated:", err.message);
    }
  }

  console.log("\n✅ USDC association complete. Fund buyer via https://faucet.circle.com (Hedera Testnet)");
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
