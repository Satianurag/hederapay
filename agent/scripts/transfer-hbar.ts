/**
 * Transfer HBAR between project testnet accounts (native Hedera transfer).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { AccountId, Client, Hbar, PrivateKey, TransferTransaction } from "@x402/hedera";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function parseKey(raw: string) {
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return PrivateKey.fromStringECDSA(key);
}

async function main() {
  const fromId = process.env.HBAR_FUND_FROM || process.env.SELLER_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  const fromKey = process.env.DEPLOYER_PRIVATE_KEY;
  const toId = process.env.HEDERA_CLIENT_ID;
  const hbar = parseFloat(process.env.HBAR_FUND_AMOUNT || "5");

  if (!fromId || !fromKey || !toId) throw new Error("Need DEPLOYER_PRIVATE_KEY, SELLER_ACCOUNT_ID, HEDERA_CLIENT_ID");

  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(fromId), parseKey(fromKey));

  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(fromId), new Hbar(-hbar))
    .addHbarTransfer(AccountId.fromString(toId), new Hbar(hbar))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  console.log(`Transferred ${hbar} HBAR: ${fromId} → ${toId} (${receipt.status})`);
  console.log(`HashScan: https://hashscan.io/testnet/transaction/${tx.transactionId.toString()}`);
  client.close();
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
