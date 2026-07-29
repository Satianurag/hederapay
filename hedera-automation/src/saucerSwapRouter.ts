import { ethers } from "ethers";
import { config } from "./config.js";
import { getSaucerSwapQuote } from "./contracts.js";

const ROUTER_ABI = [
  "function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum)) payable returns (uint256 amountOut)",
] as const;

const ERC20_ABI = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to,uint256 amount) returns (bool)",
] as const;

function encodeSwapPath(tokenIn: string, tokenOut: string, fee: number): string {
  const feeHex = fee.toString(16).padStart(6, "0");
  return `0x${tokenIn.slice(2).toLowerCase()}${feeHex}${tokenOut.slice(2).toLowerCase()}`;
}

/**
 * Execute SaucerSwap V2 exactInput (USDC→WHBAR on testnet).
 * @see https://docs.saucerswap.finance/v/developer/saucerswap-v2/swap-operations/swap-tokens-for-tokens
 * Only runs when SAUCERSWAP_EXECUTE_SWAPS=true and wallet holds SaucerSwap USDC.
 */
export async function executeSaucerSwapExactInput(
  signer: ethers.Signer,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  slippageBps = 100
): Promise<{ amountOut: bigint; txHash: string } | null> {
  if (process.env.SAUCERSWAP_EXECUTE_SWAPS !== "true") {
    return null;
  }
  if (!config.SAUCERSWAP_ROUTER_EVM) {
    throw new Error("SAUCERSWAP_ROUTER_EVM not configured");
  }

  const walletAddress = await signer.getAddress();
  const token = new ethers.Contract(tokenIn, ERC20_ABI, signer);
  const balance: bigint = await token.balanceOf(walletAddress);
  if (balance < amountIn) {
    console.log(`SaucerSwap swap skipped: balance ${balance} < ${amountIn}`);
    return null;
  }

  const allowance: bigint = await token.allowance(walletAddress, config.SAUCERSWAP_ROUTER_EVM);
  if (allowance < amountIn) {
    const approveTx = await token.approve(config.SAUCERSWAP_ROUTER_EVM, amountIn);
    await approveTx.wait();
  }

  const quote = await getSaucerSwapQuote(tokenIn, tokenOut, amountIn);
  const minOut = (quote.amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  const path = encodeSwapPath(tokenIn, tokenOut, config.SAUCERSWAP_POOL_FEE);
  const router = new ethers.Contract(config.SAUCERSWAP_ROUTER_EVM, ROUTER_ABI, signer);

  const params = {
    path,
    recipient: walletAddress,
    deadline: Math.floor(Date.now() / 1000) + 600,
    amountIn,
    amountOutMinimum: minOut,
  };

  const amountOut: bigint = await router.exactInput.staticCall(params);
  const tx = await router.exactInput(params);
  const receipt = await tx.wait();
  return { amountOut, txHash: receipt?.hash || tx.hash };
}

/** Transfer pool WHBAR from automation wallet into the Pool contract before shortfall completion. */
export async function topUpPoolWhbar(
  signer: ethers.Signer,
  poolAddress: string,
  amount: bigint
): Promise<string | null> {
  if (amount <= 0n) return null;
  const walletAddress = await signer.getAddress();
  const whbar = new ethers.Contract(config.WHBAR_ADDRESS, ERC20_ABI, signer);
  const balance: bigint = await whbar.balanceOf(walletAddress);
  if (balance < amount) {
    console.log(`Pool WHBAR top-up skipped: wallet ${balance} < ${amount}`);
    return null;
  }
  const tx = await whbar.transfer(poolAddress, amount);
  const receipt = await tx.wait();
  return receipt?.hash || tx.hash;
}
