import { ethers } from "ethers";
import { getPoolContract, getYieldReserveContract, getWalletProvider } from "../contracts.js";

/**
 * Hedera automation — yield distribution (replaces Chainlink CRE cron handler).
 */
export async function runYieldDistribution(): Promise<string> {
  console.log("=== Hedera Yield Distribution Cycle ===");
  const signer = getWalletProvider();
  const pool = getPoolContract(signer);
  const yr = getYieldReserveContract(signer);

  const [totalLiquidity, , , , investorAPY] = await pool.getPoolState();
  if (totalLiquidity === 0n) return "skipped:no_liquidity";

  const lpAddresses: string[] = await pool.getLPAddresses();
  if (lpAddresses.length === 0) return "skipped:no_lps";

  const lps: string[] = [];
  const amounts: bigint[] = [];
  let totalYield = 0n;

  for (const lp of lpAddresses) {
    const [deposited] = await pool.getLPBalance(lp);
    if (deposited > 0n) {
      const yieldAmount = (deposited * BigInt(investorAPY) * 7n) / (360n * 10000n);
      lps.push(lp);
      amounts.push(yieldAmount);
      totalYield += yieldAmount;
    }
  }

  if (totalYield === 0n) return "skipped:zero_yield";

  const reserveBalance = await yr.getReserveBalance();
  if (reserveBalance < totalYield) return "delayed:insufficient_reserve";

  const reportBytes = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address[]", "uint256[]"],
    [lps, amounts]
  );

  const yrTx = await yr.onReport(reportBytes);
  await yrTx.wait();

  const poolTx = await pool.distributeYield(lps, amounts);
  const receipt = await poolTx.wait();

  return `distributed:${totalYield}:${receipt?.hash}`;
}
