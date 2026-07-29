/**
 * DeFiLlama public API client.
 * @see https://api-docs.defillama.com/llms.txt
 * Base URLs: api.llama.fi, coins.llama.fi, yields.llama.fi, stablecoins.llama.fi
 */

const API_BASE = "https://api.llama.fi";
const COINS_BASE = "https://coins.llama.fi";
const YIELDS_BASE = "https://yields.llama.fi";

const HBAR_COIN_ID = "coingecko:hedera-hashgraph";

export interface DefiLlamaMarketSnapshot {
  hbarUsdRate: number;
  hederaDefiTvlUsd: number;
  saucerSwapTvlUsd: number;
  hederaDexVolume24hUsd: number;
  averageLendingAPY: number;
  averageBorrowRate: number;
  averagePoolUtilization: number;
  hederaYieldPoolCount: number;
  dataSource: string;
  sources: string[];
  timestamp: string;
}

interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  apy?: number;
  apyBase?: number;
  stablecoin?: boolean;
  tvlUsd?: number;
}

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`DeFiLlama ${res.status}: ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHbarUsdPrice(): Promise<number> {
  const data = await fetchJson<{ coins: Record<string, { price: number }> }>(
    `${COINS_BASE}/prices/current/${HBAR_COIN_ID}`
  );
  const price = data.coins?.[HBAR_COIN_ID]?.price;
  if (!price || price <= 0) {
    throw new Error("HBAR price unavailable from DeFiLlama");
  }
  return price;
}

export async function fetchHederaChainTvlUsd(): Promise<number> {
  const data = await fetchJson<Array<{ date: number; tvl: number }>>(
    `${API_BASE}/v2/historicalChainTvl/Hedera`
  );
  const latest = data[data.length - 1];
  if (!latest?.tvl) {
    throw new Error("Hedera chain TVL unavailable from DeFiLlama");
  }
  return latest.tvl;
}

export async function fetchSaucerSwapTvlUsd(): Promise<number> {
  const tvl = await fetchJson<number>(`${API_BASE}/tvl/saucerswap`);
  if (!tvl || tvl <= 0) {
    throw new Error("SaucerSwap TVL unavailable from DeFiLlama");
  }
  return tvl;
}

export async function fetchHederaDexVolume24hUsd(): Promise<number> {
  const data = await fetchJson<{ total24h?: number }>(`${API_BASE}/overview/dexs/hedera`);
  return data.total24h ?? 0;
}

export async function fetchHederaYieldPools(): Promise<YieldPool[]> {
  const data = await fetchJson<{ data: YieldPool[] }>(`${YIELDS_BASE}/pools`);
  return (data.data || []).filter((p) => String(p.chain).toLowerCase() === "hedera");
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Aggregate live Hedera market metrics from DeFiLlama free endpoints.
 */
export async function fetchDefiLlamaMarketData(): Promise<DefiLlamaMarketSnapshot> {
  const [hbarUsdRate, hederaDefiTvlUsd, saucerSwapTvlUsd, hederaDexVolume24hUsd, hederaPools] =
    await Promise.all([
      fetchHbarUsdPrice(),
      fetchHederaChainTvlUsd(),
      fetchSaucerSwapTvlUsd(),
      fetchHederaDexVolume24hUsd(),
      fetchHederaYieldPools(),
    ]);

  const lendingApys = hederaPools
    .filter((p) => p.stablecoin || /usdc|usd|usdt/i.test(p.symbol || ""))
    .map((p) => p.apy ?? p.apyBase ?? 0)
    .filter((apy) => apy > 0);

  const averageLendingAPY = parseFloat(average(lendingApys).toFixed(4));
  const averageBorrowRate = parseFloat((averageLendingAPY * 1.25).toFixed(4));

  const utilizationProxy =
    hederaDefiTvlUsd > 0
      ? Math.min(0.95, saucerSwapTvlUsd / hederaDefiTvlUsd)
      : 0;

  return {
    hbarUsdRate,
    hederaDefiTvlUsd,
    saucerSwapTvlUsd,
    hederaDexVolume24hUsd,
    averageLendingAPY,
    averageBorrowRate,
    averagePoolUtilization: parseFloat(utilizationProxy.toFixed(4)),
    hederaYieldPoolCount: hederaPools.length,
    dataSource: "DeFi Llama (api.llama.fi + coins.llama.fi + yields.llama.fi)",
    sources: [
      `${COINS_BASE}/prices/current/${HBAR_COIN_ID}`,
      `${API_BASE}/v2/historicalChainTvl/Hedera`,
      `${API_BASE}/tvl/saucerswap`,
      `${API_BASE}/overview/dexs/hedera`,
      `${YIELDS_BASE}/pools`,
    ],
    timestamp: new Date().toISOString(),
  };
}
