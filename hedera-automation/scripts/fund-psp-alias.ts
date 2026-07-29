import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import {
  Client,
  PrivateKey,
  AccountId,
  TransferTransaction,
  Hbar,
} from "@hiero-ledger/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const pspKey = process.env.PSP_1_PRIVATE_KEY!;
  const deployerKey = (process.env.DEPLOYER_PRIVATE_KEY || "").replace(/^0x/, "");

  const provider = new ethers.JsonRpcProvider(
    process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api",
    296
  );
  const psp = new ethers.Wallet(pspKey, provider);
  console.log("PSP1 EVM:", psp.address);

  const client = Client.forTestnet();
  const operatorKey = PrivateKey.fromStringECDSA(deployerKey);
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID || "0.0.9733389");
  client.setOperator(operatorId, operatorKey);

  const pspAlias = AccountId.fromEvmAddress(0, 0, psp.address);

  const tx = await new TransferTransaction()
    .addHbarTransfer(operatorId, new Hbar(-5))
    .addHbarTransfer(pspAlias, new Hbar(5))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  console.log("Funded PSP alias with 5 HBAR, status:", receipt.status.toString());
  console.log("HashScan:", `https://hashscan.io/testnet/transaction/${tx.transactionId.toString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
