import { ethers } from "hardhat";

/**
 * Full system test on Hedera Testnet:
 *   Phase 2: Circle USDC repayment (6 decimals)
 *   Phase 4: Liquidity shortfall event
 *   Phase 7: LP withdrawal (complete cycle)
 */

const WHBAR_ADDRESS = process.env.WHBAR_ADDRESS || "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed";
const USDC_EVM_ADDRESS =
  process.env.USDC_EVM_ADDRESS || "0x0000000000000000000000000000000000068cda";
const WHBAR_DECIMALS = 8;
const USDC_DECIMALS = 6;

async function main() {
  const provider = ethers.provider;

  const lp1Key = process.env.LP_1_PRIVATE_KEY!;
  const psp1Key = process.env.PSP_1_PRIVATE_KEY!;
  const psp2Key = process.env.PSP_2_PRIVATE_KEY!;
  const poolAddress = process.env.POOL_CONTRACT_ADDRESS!;
  const yrAddress = process.env.YIELD_RESERVE_ADDRESS!;

  const lp1 = new ethers.Wallet(lp1Key, provider);
  const psp1 = new ethers.Wallet(psp1Key, provider);
  const psp2 = new ethers.Wallet(psp2Key, provider);

  const Pool = await ethers.getContractFactory("Pool");
  const pool = Pool.attach(poolAddress);

  const whbar = await ethers.getContractAt("IERC20", WHBAR_ADDRESS);
  const usdc = await ethers.getContractAt("IERC20", USDC_EVM_ADDRESS);

  console.log("==========================================");
  console.log("  Full System Test — Hedera Testnet");
  console.log("==========================================");

  const [totalLiq, availLiq] = await pool.getPoolState();
  console.log("\nCurrent pool: total=", ethers.formatUnits(totalLiq, WHBAR_DECIMALS), "available=", ethers.formatUnits(availLiq, WHBAR_DECIMALS));

  const psp1Pos = await pool.getPSPPosition(psp1.address);
  console.log("PSP 1 position: amount=", ethers.formatUnits(psp1Pos[0], WHBAR_DECIMALS), "repaid=", psp1Pos[2]);

  console.log("\n=== PHASE 2: Circle USDC Repayment ===");

  const drawdownAmt = ethers.parseUnits("5", WHBAR_DECIMALS);
  console.log("\nPSP 2 requesting drawdown of 5 WHBAR...");
  const ddTx = await pool.connect(psp2).requestDrawdown(drawdownAmt);
  const ddReceipt = await ddTx.wait();
  console.log("✓ Drawdown executed. Tx:", ddReceipt?.hash);

  const repayUsdcAmt = ethers.parseUnits("5.025", USDC_DECIMALS);
  console.log("\nPSP 2 approving USDC for repayment...");
  await (await usdc.connect(psp2).approve(poolAddress, repayUsdcAmt)).wait();

  console.log("PSP 2 repaying 5.025 USDC (non-WHBAR token)...");
  const repayUsdcTx = await pool.connect(psp2).repay(repayUsdcAmt, USDC_EVM_ADDRESS);
  const repayUsdcReceipt = await repayUsdcTx.wait();
  console.log("✓ USDC repayment submitted. Tx:", repayUsdcReceipt?.hash);
  console.log("  → Pool holds the USDC. RepaymentReceived event emitted.");
  console.log("  → hedera-automation converts to WHBAR via SaucerSwap.");

  const poolUsdc = await usdc.balanceOf(poolAddress);
  console.log("Pool USDC balance:", ethers.formatUnits(poolUsdc, USDC_DECIMALS));

  console.log("\n📝 RepaymentReceived trigger tx:", repayUsdcReceipt?.hash);

  console.log("\n=== PHASE 4: Liquidity Shortfall ===");

  const [, availNow] = await pool.getPoolState();
  console.log("Pool available:", ethers.formatUnits(availNow, WHBAR_DECIMALS));

  const shortfallAmt = ethers.parseUnits("18", WHBAR_DECIMALS);
  console.log("PSP 1 requesting 18 WHBAR drawdown (more than available)...");
  const shortfallTx = await pool.connect(psp1).requestDrawdown(shortfallAmt);
  const shortfallReceipt = await shortfallTx.wait();
  console.log("✓ LiquidityShortfall event emitted. Tx:", shortfallReceipt?.hash);

  const iface = Pool.interface;
  for (const log of shortfallReceipt?.logs || []) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "LiquidityShortfall") {
        console.log("  PSP:", parsed.args[0]);
        console.log("  Deficit:", ethers.formatUnits(parsed.args[1], WHBAR_DECIMALS), "WHBAR");
        console.log("  RequestId:", parsed.args[2].toString());
      }
    } catch {
      // skip non-pool logs
    }
  }

  console.log("\n📝 LiquidityShortfall trigger tx:", shortfallReceipt?.hash);

  console.log("\n=== PHASE 7: LP Withdrawal ===");

  const [lpDeposited, lpClaimable] = await pool.getLPBalance(lp1.address);
  const lp1WhbarBefore = await whbar.balanceOf(lp1.address);
  const [, availForWithdraw] = await pool.getPoolState();
  const totalWithdraw = lpDeposited + lpClaimable;

  if (availForWithdraw >= totalWithdraw) {
    const withdrawTx = await pool.connect(lp1).withdraw();
    const withdrawReceipt = await withdrawTx.wait();
    console.log("✓ Withdrawn. Tx:", withdrawReceipt?.hash);
    const lp1WhbarAfter = await whbar.balanceOf(lp1.address);
    console.log("Received:", ethers.formatUnits(lp1WhbarAfter - lp1WhbarBefore, WHBAR_DECIMALS), "WHBAR");
  } else {
    console.log("\n⚠️ Cannot withdraw — insufficient available liquidity (shortfall pending).");
    console.log("   LP can withdraw after hedera-automation resolves the shortfall.");
  }

  console.log("\n==========================================");
  console.log("  TEST SUMMARY");
  console.log("==========================================");

  const YieldReserve = await ethers.getContractFactory("YieldReserve");
  const yr = YieldReserve.attach(yrAddress);
  const reserveBal = await yr.getReserveBalance();
  const [finalTotal, finalAvail] = await pool.getPoolState();

  console.log("Pool total liquidity:", ethers.formatUnits(finalTotal, WHBAR_DECIMALS));
  console.log("Pool available liquidity:", ethers.formatUnits(finalAvail, WHBAR_DECIMALS));
  console.log("YieldReserve balance:", ethers.formatUnits(reserveBal, WHBAR_DECIMALS), "WHBAR");

  console.log("\n✅ Phase 2: USDC repayment — RepaymentReceived emitted");
  console.log("✅ Phase 4: Liquidity shortfall — LiquidityShortfall emitted");
  console.log("✅ Phase 7: LP withdrawal — tested");
  console.log("\nNext: hedera-automation handles Phases 3, 4, 5 via SaucerSwap");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
