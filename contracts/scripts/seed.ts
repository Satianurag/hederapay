import { ethers } from "hardhat";

/**
 * Seed script: test the full flow on Hedera Testnet.
 *
 * Requires:
 *   - Contracts deployed (run deploy.ts first)
 *   - POOL_CONTRACT_ADDRESS and YIELD_RESERVE_ADDRESS in .env
 *   - LP_1 and PSP_1 wallets funded with WHBAR
 */

const WHBAR_ADDRESS = process.env.WHBAR_ADDRESS || "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed";
const DECIMALS = 8;

async function main() {
  const provider = ethers.provider;

  const adminKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.ADMIN_DEPLOYER_PRIVATE_KEY;
  const lp1Key = process.env.LP_1_PRIVATE_KEY;
  const psp1Key = process.env.PSP_1_PRIVATE_KEY;

  if (!adminKey || !lp1Key || !psp1Key) {
    throw new Error("Missing wallet keys in .env (DEPLOYER_PRIVATE_KEY, LP_1_PRIVATE_KEY, PSP_1_PRIVATE_KEY)");
  }

  const poolAddress = process.env.POOL_CONTRACT_ADDRESS;
  const yrAddress = process.env.YIELD_RESERVE_ADDRESS;

  if (!poolAddress || !yrAddress) {
    throw new Error("Missing POOL_CONTRACT_ADDRESS or YIELD_RESERVE_ADDRESS in .env. Deploy first.");
  }

  const admin = new ethers.Wallet(adminKey, provider);
  const lp1 = new ethers.Wallet(lp1Key, provider);
  const psp1 = new ethers.Wallet(psp1Key, provider);

  const Pool = await ethers.getContractFactory("Pool");
  const pool = Pool.attach(poolAddress);

  const whbar = await ethers.getContractAt("IERC20", WHBAR_ADDRESS);

  console.log("==========================================");
  console.log("  HederaPay Seed — Hedera Testnet");
  console.log("==========================================");
  console.log("Pool:", poolAddress);
  console.log("WHBAR:", WHBAR_ADDRESS);

  const depositAmt = ethers.parseUnits("15", DECIMALS);
  console.log("\n1. LP depositing 15 WHBAR...");
  await (await whbar.connect(lp1).approve(poolAddress, depositAmt)).wait();
  await (await pool.connect(lp1).deposit(depositAmt)).wait();
  console.log("✓ Deposit complete");

  const drawdownAmt = ethers.parseUnits("5", DECIMALS);
  console.log("\n2. PSP requesting 5 WHBAR drawdown...");
  await (await pool.connect(psp1).requestDrawdown(drawdownAmt)).wait();
  console.log("✓ Drawdown complete");

  const repayAmt = ethers.parseUnits("5.025", DECIMALS);
  console.log("\n3. PSP repaying 5.025 WHBAR...");
  await (await whbar.connect(psp1).approve(poolAddress, repayAmt)).wait();
  await (await pool.connect(psp1).repay(repayAmt, WHBAR_ADDRESS)).wait();
  console.log("✓ Repayment complete");

  const [total, avail] = await pool.getPoolState();
  console.log("\nFinal pool state:");
  console.log("  Total liquidity:", ethers.formatUnits(total, DECIMALS), "WHBAR");
  console.log("  Available:", ethers.formatUnits(avail, DECIMALS), "WHBAR");
  console.log("\n✅ Seed flow complete on Hedera testnet");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
