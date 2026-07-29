import { ethers } from "hardhat";

/**
 * Deploy HederaPay contracts to Hedera Testnet (chainId 296).
 * Pool base asset: WHBAR. Secondary repayments use Circle USDC (0.0.429274).
 */

const WHBAR_TESTNET = process.env.WHBAR_ADDRESS || "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed";
const CIRCLE_USDC_TESTNET = process.env.USDC_TOKEN_ADDRESS || "0.0.429274";

const DRAWDOWN_LIMIT = ethers.parseUnits("20", 8);
const PSP_RATE_PER_DAY = 50;
const INVESTOR_APY = 500;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const nonceForYieldReserve = await ethers.provider.getTransactionCount(deployer.address);
  const predictedPoolAddress = ethers.getCreateAddress({
    from: deployer.address,
    nonce: nonceForYieldReserve + 1,
  });

  console.log("Predicted Pool address:", predictedPoolAddress);

  console.log("\nDeploying YieldReserve...");
  const YieldReserve = await ethers.getContractFactory("YieldReserve");
  const yieldReserve = await YieldReserve.deploy(
    WHBAR_TESTNET,
    predictedPoolAddress,
    deployer.address
  );
  await yieldReserve.waitForDeployment();
  const yrAddress = await yieldReserve.getAddress();

  console.log("\nDeploying Pool...");
  const Pool = await ethers.getContractFactory("Pool");
  const pool = await Pool.deploy(WHBAR_TESTNET, yrAddress, deployer.address);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  if (poolAddress !== predictedPoolAddress) {
    throw new Error(`Pool address mismatch! Predicted ${predictedPoolAddress}, got ${poolAddress}`);
  }

  const initTx = await pool.initializePool(DRAWDOWN_LIMIT, PSP_RATE_PER_DAY, INVESTOR_APY);
  await initTx.wait();

  const hbarUsdFeed =
    process.env.CHAINLINK_HBAR_USD_FEED || "0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a";
  try {
    const feedTx = await pool.setPriceFeed(hbarUsdFeed);
    await feedTx.wait();
    console.log("Chainlink HBAR/USD feed set:", hbarUsdFeed);
  } catch (e: any) {
    console.log("Price feed set skipped:", e.message?.slice(0, 80));
  }

  console.log("\n========================================");
  console.log("  HEDERA TESTNET DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("  Network:        Hedera Testnet (296)");
  console.log("  WHBAR (pool):  ", WHBAR_TESTNET);
  console.log("  USDC (Circle): ", CIRCLE_USDC_TESTNET);
  console.log("  Pool:          ", poolAddress);
  console.log("  YieldReserve:  ", yrAddress);
  console.log("  Admin:         ", deployer.address);
  console.log("  HashScan:       https://hashscan.io/testnet/contract/" + poolAddress);
  console.log("========================================");
  console.log(`POOL_CONTRACT_ADDRESS=${poolAddress}`);
  console.log(`YIELD_RESERVE_ADDRESS=${yrAddress}`);
  console.log(`USDC_TOKEN_ADDRESS=${CIRCLE_USDC_TESTNET}`);
  console.log(`NEXT_PUBLIC_WHBAR_ADDRESS=${WHBAR_TESTNET}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${process.env.USDC_EVM_ADDRESS || "0x0000000000000000000000000000000000068cda"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
