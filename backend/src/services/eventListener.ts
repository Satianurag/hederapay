import { ethers, Log } from "ethers";
import { env } from "../config/env";
import { prisma } from "../config/db";
import { logAudit } from "../utils/audit";
import PoolABI from "../config/PoolABI.json";
import YieldReserveABI from "../config/YieldReserveABI.json";
import { ContractLogPoller, createHederaProvider } from "./contractLogPoller";

let wsProvider: ethers.WebSocketProvider | null = null;
let poolPoller: ContractLogPoller | null = null;
let yieldPoller: ContractLogPoller | null = null;

async function syncPoolState(): Promise<void> {
  try {
    if (!env.POOL_CONTRACT_ADDRESS) return;

    const rpcProvider = new ethers.JsonRpcProvider(env.HEDERA_RPC_URL, env.HEDERA_CHAIN_ID, {
      batchMaxCount: 1,
    });
    const poolContract = new ethers.Contract(env.POOL_CONTRACT_ADDRESS, PoolABI, rpcProvider);
    const [total, available, limit, rate, apy] = await poolContract.getPoolState();

    await prisma.pool.updateMany({
      where: { poolContractAddress: env.POOL_CONTRACT_ADDRESS },
      data: {
        totalLiquidity: total.toString(),
        availableLiquidity: available.toString(),
        drawdownLimit: limit.toString(),
        pspRatePerDay: Number(rate),
        investorAPY: Number(apy),
      },
    });
  } catch (err: any) {
    console.error("syncPoolState error:", err.message);
  }
}

function getPoolHandlers() {
  return {
    Deposited: async (args: unknown[], log: Log) => {
      const [lp, amount] = args as [string, bigint];
      try {
        const txHash = log.transactionHash;
        console.log(`Event: Deposited — LP: ${lp} Amount: ${amount}`);
        const deposit = await prisma.deposit.findFirst({
          where: { txHash: txHash.toLowerCase() },
        });
        if (deposit) {
          await prisma.deposit.update({
            where: { id: deposit.id },
            data: { status: "confirmed", confirmedAt: new Date() },
          });
        }
        await syncPoolState();
        await logAudit("system:event-listener", "DEPOSIT_CONFIRMED", { lp, amount: amount.toString(), txHash });
      } catch (err: any) {
        console.error("Event handler error (Deposited):", err.message);
      }
    },
    DrawdownExecuted: async (args: unknown[], log: Log) => {
      const [psp, amount] = args as [string, bigint];
      try {
        const txHash = log.transactionHash;
        console.log(`Event: DrawdownExecuted — PSP: ${psp} Amount: ${amount}`);
        const drawdown = await prisma.drawdown.findFirst({
          where: {
            pspAddress: psp.toLowerCase(),
            status: { in: ["approved", "shortfall"] },
          },
        });
        if (drawdown) {
          await prisma.drawdown.update({
            where: { id: drawdown.id },
            data: { status: "executed", txHash, executedAt: new Date() },
          });
        }
        await syncPoolState();
        await logAudit("system:event-listener", "DRAWDOWN_CONFIRMED", { psp, amount: amount.toString(), txHash });
      } catch (err: any) {
        console.error("Event handler error (DrawdownExecuted):", err.message);
      }
    },
    LiquidityShortfall: async (args: unknown[]) => {
      const [psp, deficit, requestId] = args as [string, bigint, bigint];
      try {
        console.log(`Event: LiquidityShortfall — PSP: ${psp} Deficit: ${deficit} RequestId: ${requestId}`);
        const drawdown = await prisma.drawdown.findFirst({
          where: { pspAddress: psp.toLowerCase(), status: "approved" },
        });
        if (drawdown) {
          await prisma.drawdown.update({
            where: { id: drawdown.id },
            data: { status: "shortfall", requestId: Number(requestId) },
          });
        }
        await logAudit("system:event-listener", "LIQUIDITY_SHORTFALL", {
          psp,
          deficit: deficit.toString(),
          requestId: Number(requestId),
        });
      } catch (err: any) {
        console.error("Event handler error (LiquidityShortfall):", err.message);
      }
    },
    RepaymentProcessed: async (args: unknown[], log: Log) => {
      const [psp, principal, fee] = args as [string, bigint, bigint];
      try {
        const txHash = log.transactionHash;
        console.log(`Event: RepaymentProcessed — PSP: ${psp} Principal: ${principal} Fee: ${fee}`);
        const repayment = await prisma.repayment.findFirst({
          where: { pspAddress: psp.toLowerCase(), status: "pending" },
        });
        if (repayment) {
          await prisma.repayment.update({
            where: { id: repayment.id },
            data: {
              status: "confirmed",
              principalPortion: principal.toString(),
              feePortion: fee.toString(),
              confirmedAt: new Date(),
            },
          });
        }
        await syncPoolState();
        await logAudit("system:event-listener", "REPAYMENT_CONFIRMED", {
          psp,
          principal: principal.toString(),
          fee: fee.toString(),
          txHash,
        });
      } catch (err: any) {
        console.error("Event handler error (RepaymentProcessed):", err.message);
      }
    },
    RepaymentReceived: async (args: unknown[]) => {
      const [psp, token, amount] = args as [string, string, bigint];
      try {
        console.log(`Event: RepaymentReceived (non-WHBAR) — PSP: ${psp} Token: ${token} Amount: ${amount}`);
        await logAudit("system:event-listener", "NON_USDC_REPAYMENT_RECEIVED", {
          psp,
          token,
          amount: amount.toString(),
        });
      } catch (err: any) {
        console.error("Event handler error (RepaymentReceived):", err.message);
      }
    },
    YieldDistributed: async (args: unknown[]) => {
      const [totalAmount, timestamp] = args as [bigint, bigint];
      try {
        console.log(`Event: YieldDistributed — Total: ${totalAmount} Timestamp: ${timestamp}`);
        await syncPoolState();
        await logAudit("system:event-listener", "YIELD_DISTRIBUTION_CONFIRMED", {
          totalAmount: totalAmount.toString(),
          timestamp: Number(timestamp),
        });
      } catch (err: any) {
        console.error("Event handler error (YieldDistributed):", err.message);
      }
    },
    Withdrawn: async (args: unknown[], log: Log) => {
      const [lp, amount] = args as [string, bigint];
      try {
        const txHash = log.transactionHash;
        console.log(`Event: Withdrawn — LP: ${lp} Amount: ${amount}`);
        await syncPoolState();
        await logAudit("system:event-listener", "WITHDRAWAL_CONFIRMED", { lp, amount: amount.toString(), txHash });
      } catch (err: any) {
        console.error("Event handler error (Withdrawn):", err.message);
      }
    },
  };
}

function getYieldHandlers() {
  return {
    FeeReceived: async (args: unknown[]) => {
      const [amount] = args as [bigint];
      try {
        console.log(`Event: FeeReceived — Amount: ${amount}`);
        await logAudit("system:event-listener", "FEE_RECEIVED", { amount: amount.toString() });
      } catch (err: any) {
        console.error("Event handler error (FeeReceived):", err.message);
      }
    },
    YieldPaid: async (args: unknown[]) => {
      const [lp, amount] = args as [string, bigint];
      try {
        console.log(`Event: YieldPaid — LP: ${lp} Amount: ${amount}`);
        await logAudit("system:event-listener", "YIELD_PAID", { lp, amount: amount.toString() });
      } catch (err: any) {
        console.error("Event handler error (YieldPaid):", err.message);
      }
    },
  };
}

async function startWebSocketListener(): Promise<void> {
  if (!env.HEDERA_WS_URL) throw new Error("HEDERA_WS_URL not set");

  wsProvider = new ethers.WebSocketProvider(env.HEDERA_WS_URL, env.HEDERA_CHAIN_ID, {
    batchMaxCount: 1,
  });
  const poolContract = new ethers.Contract(env.POOL_CONTRACT_ADDRESS, PoolABI, wsProvider);
  const yrContract = new ethers.Contract(env.YIELD_RESERVE_ADDRESS, YieldReserveABI, wsProvider);

  const network = await wsProvider.getNetwork();
  console.log("Event listener: Hedera WebSocket (eth_subscribe)");
  console.log("  URL:", env.HEDERA_WS_URL.replace(/\/wss\/[^/]+/, "/wss/<API_KEY>"));
  console.log("  Chain ID:", network.chainId.toString());
  console.log("  Pool:", env.POOL_CONTRACT_ADDRESS);

  poolContract.on("Deposited", async (lp: string, amount: bigint, event: any) => {
    await getPoolHandlers().Deposited([lp, amount], event.log);
  });

  poolContract.on("DrawdownExecuted", async (psp: string, amount: bigint, event: any) => {
    await getPoolHandlers().DrawdownExecuted([psp, amount], event.log);
  });

  poolContract.on("LiquidityShortfall", async (psp: string, deficit: bigint, requestId: bigint) => {
    await getPoolHandlers().LiquidityShortfall([psp, deficit, requestId]);
  });

  poolContract.on("RepaymentProcessed", async (psp: string, principal: bigint, fee: bigint, event: any) => {
    await getPoolHandlers().RepaymentProcessed([psp, principal, fee], event.log);
  });

  poolContract.on("RepaymentReceived", async (psp: string, token: string, amount: bigint) => {
    await getPoolHandlers().RepaymentReceived([psp, token, amount]);
  });

  poolContract.on("YieldDistributed", async (totalAmount: bigint, timestamp: bigint) => {
    await getPoolHandlers().YieldDistributed([totalAmount, timestamp]);
  });

  poolContract.on("Withdrawn", async (lp: string, amount: bigint, event: any) => {
    await getPoolHandlers().Withdrawn([lp, amount], event.log);
  });

  yrContract.on("FeeReceived", async (amount: bigint) => {
    await getYieldHandlers().FeeReceived([amount]);
  });

  yrContract.on("YieldPaid", async (lp: string, amount: bigint) => {
    await getYieldHandlers().YieldPaid([lp, amount]);
  });

  wsProvider.on("error", () => {
    console.log("Event listener: WebSocket error, reconnecting in 5s...");
    stopEventListener();
    setTimeout(() => startEventListener(), 5000);
  });
}

async function startPollingListener(): Promise<void> {
  const pollIntervalMs = env.EVENT_POLL_INTERVAL_MS;
  const provider = createHederaProvider(env.HEDERA_RPC_URL, env.HEDERA_CHAIN_ID, pollIntervalMs);
  const poolContract = new ethers.Contract(env.POOL_CONTRACT_ADDRESS, PoolABI, provider);
  const yrContract = new ethers.Contract(env.YIELD_RESERVE_ADDRESS, YieldReserveABI, provider);

  console.log("Event listener: HTTP log polling (eth_getLogs)");
  console.log("  Pool:", env.POOL_CONTRACT_ADDRESS);
  console.log("  Interval:", pollIntervalMs, "ms");

  poolPoller = new ContractLogPoller(provider, poolContract, getPoolHandlers(), {
    pollIntervalMs,
    lookbackBlocks: 8000,
  });
  yieldPoller = new ContractLogPoller(provider, yrContract, getYieldHandlers(), {
    pollIntervalMs,
    lookbackBlocks: 8000,
  });

  await Promise.all([poolPoller.start(), yieldPoller.start()]);
}

export async function startEventListener(): Promise<void> {
  if (!env.POOL_CONTRACT_ADDRESS || !env.YIELD_RESERVE_ADDRESS) {
    console.log("Event listener: Contract addresses not set, skipping");
    return;
  }

  try {
    if (env.HEDERA_WS_URL) {
      await startWebSocketListener();
      return;
    }
  } catch (err: any) {
    console.warn("Event listener: WebSocket failed, falling back to polling:", err.message);
    stopEventListener();
  }

  try {
    await startPollingListener();
  } catch (err: any) {
    console.error("Event listener failed to start:", err.message);
    console.log("Retrying in 10s...");
    setTimeout(() => startEventListener(), 10000);
  }
}

export function stopEventListener(): void {
  poolPoller?.stop();
  yieldPoller?.stop();
  poolPoller = null;
  yieldPoller = null;

  if (wsProvider) {
    wsProvider.destroy();
    wsProvider = null;
    console.log("Event listener stopped");
  }
}
