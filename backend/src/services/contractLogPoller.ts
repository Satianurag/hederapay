import { ethers, Contract, JsonRpcProvider, Log } from "ethers";

export type LogHandler = (args: unknown[], log: Log) => void | Promise<void>;

export interface ContractLogPollerOptions {
  pollIntervalMs?: number;
  maxBlockRange?: number;
  lookbackBlocks?: number;
}

/**
 * Poll contract logs via eth_getLogs (queryFilter).
 * Avoids eth_newFilter which HashIO rejects in batch requests.
 * @see https://docs.ethers.org/v6/api/providers — polling + getLogs
 */
export class ContractLogPoller {
  private lastBlock = 0;
  private readonly seen = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly provider: JsonRpcProvider,
    private readonly contract: Contract,
    private readonly handlers: Record<string, LogHandler>,
    private readonly options: ContractLogPollerOptions = {}
  ) {}

  async start(): Promise<void> {
    const current = await this.provider.getBlockNumber();
    const lookback = this.options.lookbackBlocks ?? 5000;
    this.lastBlock = Math.max(0, current - lookback);
    this.running = true;

    await this.poll();
    const interval = this.options.pollIntervalMs ?? 12_000;
    this.timer = setInterval(() => {
      this.poll().catch((err) => console.error("ContractLogPoller poll error:", err.message));
    }, interval);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private logKey(log: Log): string {
    return `${log.blockNumber}:${log.index}:${log.transactionHash}`;
  }

  async poll(): Promise<number> {
    if (!this.running && this.lastBlock === 0) return 0;

    const toBlock = await this.provider.getBlockNumber();
    if (toBlock <= this.lastBlock) return 0;

    const maxRange = this.options.maxBlockRange ?? 2000;
    const fromBlock = Math.max(this.lastBlock + 1, toBlock - maxRange);
    let processed = 0;

    for (const eventName of Object.keys(this.handlers)) {
      const logs = await this.contract.queryFilter(eventName, fromBlock, toBlock);
      for (const log of logs) {
        const key = this.logKey(log);
        if (this.seen.has(key)) continue;
        this.seen.add(key);

        const parsed = this.contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (!parsed) continue;

        await this.handlers[eventName](Array.from(parsed.args), log);
        processed++;
      }
    }

    this.lastBlock = toBlock;
    return processed;
  }
}

export function createHederaProvider(
  rpcUrl: string,
  chainId: number,
  pollIntervalMs = 12_000
): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl, chainId, {
    batchMaxCount: 1,
    polling: true,
    pollingInterval: pollIntervalMs,
  });
}
