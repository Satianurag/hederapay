/**
 * Transfer Circle USDC (0.0.429274) from seller/deployer to x402 buyer account.
 * @see https://github.com/hashgraph/hedera-docs — TransferTransaction HTS token transfer
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  AccountId,
  Client,
  PrivateKey,
  TokenId,
  TransferTransaction,
} from "@x402/hedera";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const USDC = process.env.USDC_TOKEN_ADDRESS || "0.0.429274";
const AMOUNT = BigInt(process.env.USDC_FUND_AMOUNT || "100000"); // 0.1 USDC default

function parseKey(raw: string) {
  const keyType = (process.env.HEDERA_KEY_TYPE || "ecdsa").toLowerCase();
  if (keyType === "ed25519") return PrivateKey.fromStringED25519(raw);
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return PrivateKey.fromStringECDSA(key);
}

async function getUsdcBalance(accountId: string): Promise<bigint> {
  const res = await fetch(
    `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${USDC}`
  );
  const data = (await res.json()) as { tokens?: { balance: number }[] };
  return BigInt(data.tokens?.[0]?.balance ?? 0);
}

async function main() {
  const fromId = process.env.USDC_FUND_FROM || process.env.SELLER_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  const fromKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.OPERATOR_KEY;
  const toId = process.env.HEDERA_CLIENT_ID || process.env.HEDERA_ACCOUNT_ID;

  if (!fromId || !fromKey || !toId) {
    throw new Error("Need USDC_FUND_FROM/DEPLOYER_PRIVATE_KEY and HEDERA_CLIENT_ID");
  }

  const fromBalance = await getUsdcBalance(fromId);
  console.log(`Seller ${fromId} USDC balance: ${fromBalance} (${Number(fromBalance) / 1e6} USDC)`);

  if (fromBalance < AMOUNT) {
    throw new Error(
      `Insufficient Circle USDC on ${fromId}. Mint at https://faucet.circle.com (Hedera Testnet, account ${fromId}), then re-run.`
    );
  }

  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(fromId), parseKey(fromKey));

  const tx = await new TransferTransaction()
    .addTokenTransfer(TokenId.fromString(USDC), AccountId.fromString(fromId), -AMOUNT)
    .addTokenTransfer(TokenId.fromString(USDC), AccountId.fromString(toId), AMOUNT)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  console.log(`Transferred ${Number(AMOUNT) / 1e6} USDC → ${toId}: ${receipt.status}`);
  console.log(`HashScan: https://hashscan.io/testnet/transaction/${tx.transactionId.toString()}`);
  client.close();
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
