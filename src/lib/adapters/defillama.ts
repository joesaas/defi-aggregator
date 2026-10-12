import type { Adapter, AdapterResult, AdapterFailure } from "./types";
import type { YieldPoint } from "../types";

/**
 * DeFiLlama Yields 适配器。
 *
 * 架构定位（§3）：DeFiLlama 为交叉校验源与 TVL 补充；一期工程切片中，
 * 协议类产品（Aave / Compound / Lido）先以它作为实时行情入口接入
 * （其数据本身聚合自链上），Aave 官方 GraphQL 适配器为后续主源替换项。
 * source 字段如实记为 "aggregator"，不冒充协议官方 API。
 *
 * 同一 (project, chain, symbol) 可能有多个池条目，取 TVL 最大者为主市场。
 */
const POOLS_URL = "https://yields.llama.fi/pools";

export const DEFILLAMA_POOL_MAP: Record<
  string,
  { project: string; chain: string; symbol: string }
> = {
  "aave-v3-usdc-ethereum": { project: "aave-v3", chain: "Ethereum", symbol: "USDC" },
  "aave-v3-usdt-ethereum": { project: "aave-v3", chain: "Ethereum", symbol: "USDT" },
  "aave-v3-weth-ethereum": { project: "aave-v3", chain: "Ethereum", symbol: "WETH" },
  "aave-v3-dai-ethereum": { project: "aave-v3", chain: "Ethereum", symbol: "DAI" },
  "aave-v3-usdc-base": { project: "aave-v3", chain: "Base", symbol: "USDC" },
  "compound-v3-usdc-ethereum": { project: "compound-v3", chain: "Ethereum", symbol: "USDC" },
  "lido-steth-ethereum": { project: "lido", chain: "Ethereum", symbol: "STETH" },
};

interface LlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  rewardTokens: string[] | null;
  pool: string;
}

export const defillamaAdapter: Adapter = {
  name: "defillama",
  async fetchAll() {
    const results: AdapterResult[] = [];
    const failures: AdapterFailure[] = [];
    let pools: LlamaPool[];
    try {
      const res = await fetch(POOLS_URL, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data: LlamaPool[] };
      pools = body.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        results,
        failures: Object.keys(DEFILLAMA_POOL_MAP).map((productId) => ({
          productId,
          error: `defillama fetch failed: ${msg}`,
        })),
      };
    }

    const ts = new Date().toISOString();
    for (const [productId, key] of Object.entries(DEFILLAMA_POOL_MAP)) {
      const candidates = pools
        .filter(
          (p) => p.project === key.project && p.chain === key.chain && p.symbol === key.symbol,
        )
        .sort((a, b) => b.tvlUsd - a.tvlUsd);
      const pool = candidates[0];
      if (!pool || pool.apy == null) {
        failures.push({ productId, error: "pool not found in defillama yields" });
        continue;
      }
      const point: YieldPoint = {
        productId,
        nominalApy: pool.apy,
        baseApy: pool.apyBase ?? pool.apy,
        subsidyApy: 0,
        rewardApy: pool.apyReward ?? 0,
        rewardToken: pool.rewardTokens?.[0] ?? null,
        tvlUsd: pool.tvlUsd,
        utilization: null,
        source: "aggregator",
        ts,
      };
      results.push({ productId, point, raw: pool });
    }
    return { results, failures };
  },
};
