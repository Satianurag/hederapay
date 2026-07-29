import { POOL_ADDRESS, WHBAR_ADDRESS, USDC_ADDRESS } from "./chain";

export const ERC20_ABI = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

export const POOL_ABI = [
  { inputs: [{ name: "amount", type: "uint256" }], name: "deposit", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "withdraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "amount", type: "uint256" }], name: "requestDrawdown", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "amount", type: "uint256" }, { name: "token", type: "address" }], name: "repay", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "getPoolState", outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "lp", type: "address" }], name: "getLPBalance", outputs: [{ name: "deposited", type: "uint256" }, { name: "claimable", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "psp", type: "address" }], name: "getPSPPosition", outputs: [{ name: "amount", type: "uint256" }, { name: "timestamp", type: "uint256" }, { name: "repaid", type: "bool" }], stateMutability: "view", type: "function" },
] as const;

export const contractConfig = {
  pool: { address: POOL_ADDRESS, abi: POOL_ABI },
  whbar: { address: WHBAR_ADDRESS, abi: ERC20_ABI },
  usdc: { address: USDC_ADDRESS, abi: ERC20_ABI },
} as const;
