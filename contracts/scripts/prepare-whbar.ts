import { ethers } from "hardhat";

/**
 * Prepare LP/PSP wallets for seed.ts on Hedera testnet:
 * 1. Associate WHBAR HTS token (required before transfers)
 * 2. Wrap HBAR → WHBAR via deposit()
 * 3. Transfer WHBAR to LP/PSP if different from deployer
 */
const WHBAR = process.env.WHBAR_ADDRESS || "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed";
const WHBAR_ABI = [
  "function associate() external",
  "function deposit() payable",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
] as const;

async function associateIfNeeded(signer: ethers.Wallet, label: string) {
  const whbar = new ethers.Contract(WHBAR, WHBAR_ABI, signer);
  try {
    const tx = await whbar.associate({ gasLimit: 800_000 });
    await tx.wait();
    console.log(`✓ ${label} associated WHBAR (${tx.hash})`);
  } catch (e: any) {
    const msg = e.message || "";
    if (msg.includes("ALREADY_ASSOCIATED") || msg.includes("TOKEN_ALREADY_ASSOCIATED")) {
      console.log(`· ${label} already associated WHBAR`);
    } else {
      console.log(`· ${label} associate skipped: ${msg.slice(0, 120)}`);
    }
  }
}

async function wrapHbar(signer: ethers.Wallet, hbarAmount: string, label: string) {
  const whbar = new ethers.Contract(WHBAR, WHBAR_ABI, signer);
  const before = await whbar.balanceOf(signer.address);
  // WHBAR deposit uses 18-decimal weibars (1 HBAR = 10^18 weibars)
  const value = ethers.parseUnits(hbarAmount, 18);
  const tx = await whbar.deposit({ value, gasLimit: 500_000 });
  await tx.wait();
  const after = await whbar.balanceOf(signer.address);
  console.log(`✓ ${label} wrapped ${hbarAmount} HBAR → WHBAR (${ethers.formatUnits(after - before, 8)} new)`);
}

async function main() {
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY!;
  const lpKey = process.env.LP_1_PRIVATE_KEY!;
  const pspKey = process.env.PSP_1_PRIVATE_KEY!;

  const deployer = new ethers.Wallet(deployerKey, ethers.provider);
  const lp = new ethers.Wallet(lpKey, ethers.provider);
  const psp = new ethers.Wallet(pspKey, ethers.provider);

  console.log("Deployer:", deployer.address);
  console.log("LP1:     ", lp.address);
  console.log("PSP1:    ", psp.address);

  for (const [label, wallet] of [
    ["deployer", deployer],
    ["LP1", lp],
    ["PSP1", psp],
  ] as const) {
    await associateIfNeeded(wallet, label);
  }

  const whbar = new ethers.Contract(WHBAR, WHBAR_ABI, deployer);
  const lpBal = await whbar.balanceOf(lp.address);
  const pspBal = await whbar.balanceOf(psp.address);

  if (lpBal < ethers.parseUnits("20", 8)) {
    const needed = ethers.parseUnits("25", 8) - lpBal;
    if (deployer.address === lp.address) {
      await wrapHbar(deployer, "30", "deployer/LP1");
    } else {
      const deployerBal = await whbar.balanceOf(deployer.address);
      if (deployerBal < needed) await wrapHbar(deployer, "30", "deployer");
      const tx = await whbar.transfer(lp.address, needed);
      await tx.wait();
      console.log(`✓ Transferred ${ethers.formatUnits(needed, 8)} WHBAR to LP1`);
    }
  } else {
    console.log(`· LP1 already has ${ethers.formatUnits(lpBal, 8)} WHBAR`);
  }

  if (pspBal < ethers.parseUnits("10", 8)) {
    const needed = ethers.parseUnits("10", 8) - pspBal;
    const freshBal = await whbar.balanceOf(deployer.address);
    if (freshBal < needed) await wrapHbar(deployer, "15", "deployer");
    const tx = await whbar.transfer(psp.address, needed);
    await tx.wait();
    console.log(`✓ Transferred ${ethers.formatUnits(needed, 8)} WHBAR to PSP1`);
  } else {
    console.log(`· PSP1 already has ${ethers.formatUnits(pspBal, 8)} WHBAR`);
  }

  const finalLp = await whbar.balanceOf(lp.address);
  const finalPsp = await whbar.balanceOf(psp.address);
  console.log("\nFinal balances:");
  console.log("  LP1 WHBAR:", ethers.formatUnits(finalLp, 8));
  console.log("  PSP1 WHBAR:", ethers.formatUnits(finalPsp, 8));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
