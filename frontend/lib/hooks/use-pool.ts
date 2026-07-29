"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { POOL_ABI, ERC20_ABI } from "../contracts";
import { POOL_ADDRESS, WHBAR_ADDRESS, USDC_ADDRESS } from "../chain";

export function useApproveToken(tokenAddress: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function approve(amount: bigint) {
    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [POOL_ADDRESS, amount],
    });
  }

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

export function useDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function deposit(amount: bigint) {
    writeContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: "deposit",
      args: [amount],
    });
  }

  return { deposit, hash, isPending, isConfirming, isSuccess, error };
}

export function useWithdraw() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function withdraw() {
    writeContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: "withdraw",
    });
  }

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}

export function useRequestDrawdown() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function requestDrawdown(amount: bigint) {
    writeContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: "requestDrawdown",
      args: [amount],
    });
  }

  return { requestDrawdown, hash, isPending, isConfirming, isSuccess, error };
}

export function useRepay() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function repay(amount: bigint, tokenAddress: `0x${string}`) {
    writeContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: "repay",
      args: [amount, tokenAddress],
    });
  }

  return { repay, hash, isPending, isConfirming, isSuccess, error };
}

export function usePoolState() {
  const { data, isLoading } = useReadContract({
    address: POOL_ADDRESS,
    abi: POOL_ABI,
    functionName: "getPoolState",
  });

  return {
    totalLiquidity: data?.[0],
    availableLiquidity: data?.[1],
    drawdownLimit: data?.[2],
    pspRatePerDay: data?.[3],
    investorAPY: data?.[4],
    isLoading,
  };
}

export function useLPBalance(address?: `0x${string}`) {
  const { data, isLoading } = useReadContract({
    address: POOL_ADDRESS,
    abi: POOL_ABI,
    functionName: "getLPBalance",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return { deposited: data?.[0], claimable: data?.[1], isLoading };
}

export function usePSPPosition(address?: `0x${string}`) {
  const { data, isLoading } = useReadContract({
    address: POOL_ADDRESS,
    abi: POOL_ABI,
    functionName: "getPSPPosition",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return { amount: data?.[0], timestamp: data?.[1], repaid: data?.[2], isLoading };
}
