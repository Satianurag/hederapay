import { ethers } from "ethers";
import { env } from "../config/env";
import PoolABI from "../config/PoolABI.json";
import YieldReserveABI from "../config/YieldReserveABI.json";

let provider: ethers.JsonRpcProvider | null = null;
let poolContract: ethers.Contract | null = null;
let yieldReserveContract: ethers.Contract | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(env.HEDERA_RPC_URL, env.HEDERA_CHAIN_ID);
  }
  return provider;
}

export function getPoolContract(): ethers.Contract {
  if (!poolContract) {
    if (!env.POOL_CONTRACT_ADDRESS) {
      throw new Error("POOL_CONTRACT_ADDRESS not set");
    }
    poolContract = new ethers.Contract(env.POOL_CONTRACT_ADDRESS, PoolABI, getProvider());
  }
  return poolContract;
}

export function getYieldReserveContract(): ethers.Contract {
  if (!yieldReserveContract) {
    if (!env.YIELD_RESERVE_ADDRESS) {
      throw new Error("YIELD_RESERVE_ADDRESS not set");
    }
    yieldReserveContract = new ethers.Contract(
      env.YIELD_RESERVE_ADDRESS,
      YieldReserveABI,
      getProvider()
    );
  }
  return yieldReserveContract;
}

export async function getPoolState(): Promise<{
  totalLiquidity: string;
  availableLiquidity: string;
  drawdownLimit: string;
  pspRatePerDay: number;
  investorAPY: number;
}> {
  const pool = getPoolContract();
  const [total, available, limit, rate, apy] = await pool.getPoolState();
  return {
    totalLiquidity: total.toString(),
    availableLiquidity: available.toString(),
    drawdownLimit: limit.toString(),
    pspRatePerDay: Number(rate),
    investorAPY: Number(apy),
  };
}

export async function getLPBalance(lpAddress: string): Promise<{ deposited: string; claimable: string }> {
  const pool = getPoolContract();
  const [deposited, claimable] = await pool.getLPBalance(lpAddress);
  return { deposited: deposited.toString(), claimable: claimable.toString() };
}

export async function getPSPPosition(
  pspAddress: string
): Promise<{ amount: string; timestamp: number; repaid: boolean }> {
  const pool = getPoolContract();
  const [amount, timestamp, repaid] = await pool.getPSPPosition(pspAddress);
  return { amount: amount.toString(), timestamp: Number(timestamp), repaid };
}

export async function getLPAddresses(): Promise<string[]> {
  const pool = getPoolContract();
  return await pool.getLPAddresses();
}

export async function isPoolInitialized(): Promise<boolean> {
  const pool = getPoolContract();
  return await pool.initialized();
}

export async function getReserveBalance(): Promise<string> {
  const yr = getYieldReserveContract();
  const balance = await yr.getReserveBalance();
  return balance.toString();
}

export async function getReserveTotalFees(): Promise<string> {
  const yr = getYieldReserveContract();
  const fees = await yr.totalFees();
  return fees.toString();
}

export async function getReserveTotalDistributed(): Promise<string> {
  const yr = getYieldReserveContract();
  const distributed = await yr.totalDistributed();
  return distributed.toString();
}

export async function getTransactionReceipt(
  txHash: string
): Promise<ethers.TransactionReceipt | null> {
  return await getProvider().getTransactionReceipt(txHash);
}

export async function isTransactionConfirmed(txHash: string): Promise<boolean> {
  const receipt = await getTransactionReceipt(txHash);
  return receipt !== null && receipt.status === 1;
}
