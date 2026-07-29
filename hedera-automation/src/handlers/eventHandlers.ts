import { config } from "../config.js";
import { getPoolContract, getWalletProvider, getSaucerSwapQuote } from "../contracts.js";
import { executeSaucerSwapExactInput, topUpPoolWhbar } from "../saucerSwapRouter.js";
import {
  getChainlinkHbarUsdSnapshot,
  validateSwapAgainstChainlink,
  whbarToUsd,
} from "../services/chainlinkPrice.js";
import { ContractLogPoller, createHederaProvider } from "../services/contractLogPoller.js";

let poolPoller: ContractLogPoller | null = null;

/**
 * Event handlers — liquidity shortfall & repayment conversion.
 * Uses eth_getLogs polling (not eth_newFilter) for HashIO compatibility.
 */
export async function startEventHandlers() {
  if (!config.POOL_ADDRESS) {
    console.log("POOL_CONTRACT_ADDRESS not set — event handlers skipped");
    return;
  }

  const pollIntervalMs = config.EVENT_POLL_INTERVAL_MS;
  const provider = createHederaProvider(config.HEDERA_RPC_URL, config.HEDERA_CHAIN_ID, pollIntervalMs);
  const pool = getPoolContract(getWalletProvider());

  console.log("Hedera automation: polling Pool events on", config.POOL_ADDRESS);
  console.log("  Mode: eth_getLogs (queryFilter), interval:", pollIntervalMs, "ms");

  poolPoller = new ContractLogPoller(
    provider,
    pool,
    {
      LiquidityShortfall: async (args) => {
        const [psp, deficit, requestId] = args as [string, bigint, bigint];
        console.log(`=== Liquidity Shortfall: PSP=${psp} deficit=${deficit} id=${requestId} ===`);
        try {
          const oracle = await getChainlinkHbarUsdSnapshot();
          const deficitUsd = whbarToUsd(deficit, oracle.answer, oracle.decimals);
          console.log(
            `Chainlink HBAR/USD: $${oracle.priceUsd.toFixed(6)}${oracle.stale ? " (stale)" : ""} | deficit ≈ $${deficitUsd.toFixed(4)}`
          );

          if (config.SAUCERSWAP_QUOTER_EVM) {
            // SaucerSwap testnet pool: SS_USDC (0.0.5449) / SS_WHBAR (0.0.15058) — NOT pool WHBAR (0xb1F616...)
            const usdcEstimate = BigInt(Math.max(1, Math.round(deficitUsd * 1e6)));
            const quote = await getSaucerSwapQuote(
              config.SAUCERSWAP_USDC_EVM,
              config.SAUCERSWAP_WHBAR_EVM,
              usdcEstimate
            );
            console.log("SaucerSwap USDC->WHBAR quote for ~$" + deficitUsd.toFixed(2) + ":", quote.amountOut.toString(), "SS_WHBAR units");

            const signer = getWalletProvider();
            const swap = await executeSaucerSwapExactInput(
              signer,
              config.SAUCERSWAP_USDC_EVM,
              config.SAUCERSWAP_WHBAR_EVM,
              usdcEstimate
            );
            if (swap) console.log("SaucerSwap swap tx:", swap.txHash);
          }

          // Pool contract holds POOL_WHBAR — transfer from automation wallet before completeDrawdown
          const topUpTx = await topUpPoolWhbar(getWalletProvider(), config.POOL_ADDRESS, deficit);
          if (topUpTx) console.log("Pool WHBAR top-up tx:", topUpTx);

          const tx = await pool.completeDrawdown(psp, requestId);
          const receipt = await tx.wait();
          console.log("completeDrawdown tx:", receipt?.hash);
        } catch (err: any) {
          console.error("Shortfall handler error:", err.message);
        }
      },
      RepaymentReceived: async (args) => {
        const [psp, token, amount] = args as [string, string, bigint];
        console.log(`=== Repayment: PSP=${psp} token=${token} amount=${amount} ===`);
        try {
          let whbarAmount = amount;
          const isPoolWhbar = token.toLowerCase() === config.WHBAR_ADDRESS.toLowerCase();
          const isCircleUsdc = token.toLowerCase() === config.USDC_EVM_ADDRESS.toLowerCase();
          const isSaucerUsdc = token.toLowerCase() === config.SAUCERSWAP_USDC_EVM.toLowerCase();

          if (!isPoolWhbar) {
            if (isSaucerUsdc) {
              const quote = await getSaucerSwapQuote(config.SAUCERSWAP_USDC_EVM, config.SAUCERSWAP_WHBAR_EVM, amount);
              whbarAmount = quote.amountOut;
              console.log("SaucerSwap SS_USDC conversion:", amount.toString(), "->", whbarAmount.toString());

              const swap = await executeSaucerSwapExactInput(
                getWalletProvider(),
                config.SAUCERSWAP_USDC_EVM,
                config.SAUCERSWAP_WHBAR_EVM,
                amount
              );
              if (swap) console.log("SaucerSwap repayment swap tx:", swap.txHash);
            } else if (isCircleUsdc) {
              // Circle USDC has no SaucerSwap pool on testnet — oracle estimate only
              const oracle = await getChainlinkHbarUsdSnapshot();
              const usd = Number(amount) / 1e6;
              whbarAmount = BigInt(Math.max(1, Math.round((usd / oracle.priceUsd) * 1e8)));
              console.log(`Circle USDC repayment: $${usd.toFixed(4)} ≈ ${whbarAmount} pool WHBAR (Chainlink HBAR/USD)`);
            } else {
              const quote = await getSaucerSwapQuote(token, config.SAUCERSWAP_WHBAR_EVM, amount);
              whbarAmount = quote.amountOut;
              console.log("SaucerSwap conversion:", amount.toString(), "->", whbarAmount.toString());
            }

            if (isSaucerUsdc || isCircleUsdc) {
              const oracle = await getChainlinkHbarUsdSnapshot();
              const check = validateSwapAgainstChainlink(
                isCircleUsdc ? amount : amount,
                whbarAmount,
                oracle
              );
              console.log(
                `Oracle check: implied HBAR/USD $${check.impliedHbarUsd.toFixed(6)} vs Chainlink $${oracle.priceUsd.toFixed(6)} → ${check.withinTolerance ? "OK" : "DEVIATION"}`
              );
            }
          }
          const tx = await pool.processConvertedRepayment(psp, whbarAmount);
          const receipt = await tx.wait();
          console.log("processConvertedRepayment tx:", receipt?.hash);
        } catch (err: any) {
          console.error("Repayment handler error:", err.message);
        }
      },
    },
    { pollIntervalMs, lookbackBlocks: 8000 }
  );

  await poolPoller.start();
}

export function stopEventHandlers(): void {
  poolPoller?.stop();
  poolPoller = null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startEventHandlers().catch(console.error);
}
