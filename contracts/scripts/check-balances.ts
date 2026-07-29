import { ethers } from "hardhat";

const WHBAR = process.env.WHBAR_ADDRESS || "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed";

async function main() {
  const poolAddress = process.env.POOL_CONTRACT_ADDRESS!;
  const Pool = await ethers.getContractFactory("Pool");
  const pool = Pool.attach(poolAddress);
  const initialized = await pool.initialized();
  console.log("Pool initialized:", initialized);

  const whbar = await ethers.getContractAt("IERC20", WHBAR);
  for (const [name, key] of [
    ["LP1", process.env.LP_1_PRIVATE_KEY],
    ["PSP1", process.env.PSP_1_PRIVATE_KEY],
    ["deployer", process.env.DEPLOYER_PRIVATE_KEY],
  ] as const) {
    if (!key) continue;
    const w = new ethers.Wallet(key, ethers.provider);
    const bal = await whbar.balanceOf(w.address);
    console.log(`${name} ${w.address} WHBAR=${ethers.formatUnits(bal, 8)}`);
  }
}

main().catch(console.error);
