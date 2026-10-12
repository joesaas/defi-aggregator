import { createHmac } from "node:crypto";
import type { Adapter, AdapterResult, AdapterFailure } from "./types";
import { SourceUnavailableError } from "./types";
import type { YieldPoint } from "../types";

/**
 * Binance Simple Earn 适配器（官方 SAPI，签名接口）。
 *
 * 凭据经环境变量 BINANCE_API_KEY / BINANCE_API_SECRET 注入（架构 §3：
 * 凭据不进代码库、不进日志）。未配置时对每个产品返回失败，
 * 采集层据此把新鲜度标为 none/expired——**不使用任何估算值冒充实时利率**。
 *
 * 接口：GET /sapi/v1/simple-earn/flexible/list（活期产品及最新日利率）
 * 年化换算：apy% = latestDailyYieldRate × 365 × 100。
 */
const BASE = "https://api.binance.com";

/** 本适配器覆盖的产品：产品 id → 币种 */
export const BINANCE_FLEXIBLE_MAP: Record<string, string> = {
  "binance-simple-earn-usdt": "USDT",
  "binance-simple-earn-usdc": "USDC",
  "binance-simple-earn-btc": "BTC",
};

interface FlexibleRow {
  asset: string;
  latestDailyYieldRate: string;
  canPurchase: boolean;
  canRedeem: boolean;
}

function credentials(): { key: string; secret: string } {
  const key = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_API_SECRET;
  if (!key || !secret) {
    throw new SourceUnavailableError(
      "BINANCE_API_KEY / BINANCE_API_SECRET not configured",
    );
  }
  return { key, secret };
}

async function fetchFlexibleList(): Promise<FlexibleRow[]> {
  const { key, secret } = credentials();
  const query = `timestamp=${Date.now()}&recvWindow=5000`;
  const signature = createHmac("sha256", secret).update(query).digest("hex");
  const res = await fetch(
    `${BASE}/sapi/v1/simple-earn/flexible/list?${query}&signature=${signature}`,
    { headers: { "X-MBX-APIKEY": key } },
  );
  if (!res.ok) throw new Error(`binance sapi HTTP ${res.status}`);
  const body = (await res.json()) as { rows?: FlexibleRow[] };
  return body.rows ?? [];
}

export const binanceAdapter: Adapter = {
  name: "binance",
  async fetchAll() {
    const results: AdapterResult[] = [];
    const failures: AdapterFailure[] = [];
    let rows: FlexibleRow[];
    try {
      rows = await fetchFlexibleList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        results,
        failures: Object.keys(BINANCE_FLEXIBLE_MAP).map((productId) => ({
          productId,
          error: msg,
        })),
      };
    }
    const ts = new Date().toISOString();
    for (const [productId, asset] of Object.entries(BINANCE_FLEXIBLE_MAP)) {
      const row = rows.find((r) => r.asset === asset);
      const daily = row ? Number(row.latestDailyYieldRate) : NaN;
      if (!row || !Number.isFinite(daily)) {
        failures.push({ productId, error: `asset ${asset} not in flexible list` });
        continue;
      }
      const apy = daily * 365 * 100;
      const point: YieldPoint = {
        productId,
        nominalApy: apy,
        baseApy: apy,
        subsidyApy: 0, // 分层补贴需 tier 明细接口，接入后单独填充并走公式摊销
        rewardApy: 0,
        rewardToken: null,
        tvlUsd: null,
        utilization: null,
        source: "api",
        ts,
      };
      results.push({ productId, point, raw: row });
    }
    return { results, failures };
  },
};
