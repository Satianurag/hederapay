import { ethers } from "hardhat";

/** Continue seed from drawdown step (after LP deposit already done). */
const WHBAR = process.env.WHBAR_ADDRESS || "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed";
const DECIMALS = 8;

async function main() {
  const poolAddress = process.env.POOL_CONTRACT_ADDRESS!;
  const psp1 = new ethers.Wallet(process.env.PSP_1_PRIVATE_KEY!, ethers.provider);
  const Pool = await ethers.getContractFactory("Pool");
  const pool = Pool.attach(poolAddress);
  const whbar = await ethers.getContractAt("IERC20", WHBAR);

  const drawdownAmt = ethers.parseUnits("5", DECIMALS);
  console.log("PSP drawdown 5 WHBAR from", psp1.address);
  await (await pool.connect(psp1).requestDrawdown(drawdownAmt)).wait();
  console.log("✓ Drawdown complete");

  const repayAmt = ethers.parseUnits("5.025", DECIMALS);
  console.log("PSP repaying 5.025 WHBAR...");
  await (await whbar.connect(psp1).approve(poolAddress, repayAmt)).wait();
  await (await pool.connect(psp1).repay(repayAmt, WHBAR)).wait();
  console.log("✓ Repayment complete");

  const [total, avail] = await pool.getPoolState();
  console.log("Pool total:", ethers.formatUnits(total, DECIMALS), "avail:", ethers.formatUnits(avail, DECIMALS));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
