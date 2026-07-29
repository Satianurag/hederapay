import { ethers } from "hardhat";

/** Grant CRE_ROLE on Pool + YieldReserve to deployer (automation wallet). */
async function main() {
  const automation = process.env.AUTOMATION_WALLET_ADDRESS || (await ethers.getSigners())[0].address;
  const poolAddr = process.env.POOL_CONTRACT_ADDRESS!;
  const yrAddr = process.env.YIELD_RESERVE_ADDRESS!;

  const Pool = await ethers.getContractFactory("Pool");
  const YieldReserve = await ethers.getContractFactory("YieldReserve");
  const pool = Pool.attach(poolAddr);
  const yr = YieldReserve.attach(yrAddr);

  console.log("Granting CRE_ROLE to", automation);
  await (await pool.grantCRERole(automation)).wait();
  await (await yr.grantCRERole(automation)).wait();
  console.log("✓ CRE_ROLE granted on Pool and YieldReserve");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
