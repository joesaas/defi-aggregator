import { createHmac } from "node:crypto";
import type { Adapter, AdapterResult, AdapterFailure } from "./types";
import { SourceUnavailableError } from "./types";
import type { YieldPoint } from "../types";

/**
 * OKX Earn 适配器（官方 API v5，签名接口）。
 *
 * 凭据经环境变量 OKX_API_KEY / OKX_API_SECRET / OKX_API_PASSPHRASE 注入，
 * 未配置时对每个产品返回失败（同 Binance 适配器的降级原则，不伪造数据）。
 *
 * 接口：
 * - 简单赚币活期：GET /api/v5/finance/savings/lending-rate-summary?ccy=<ccy>
 *   （返回预估出借年化 estRate，小数口径，×100 为百分数）
 * - 链上赚币 offers：GET /api/v5/finance/staking-defi/offers
 *   （返回各 offer 的 apy 百分数口径与期限/最低额字段）
 *
 * 签名：OK-ACCESS-SIGN = base64(HMAC-SHA256(secret, timestamp + method + path + body))，
 * timestamp 为 ISO 8601 UTC。
 */
const BASE = "https://www.okx.com";

export const OKX_SAVINGS_MAP: Record<string, string> = {
  "okx-simple-earn-usdt": "USDT",
  "okx-simple-earn-usdc": "USDC",
};
export const OKX_STAKING_PRODUCT = "okx-onchain-earn-eth";

function credentials(): { key: string; secret: string; passphrase: string } {
  const key = process.env.OKX_API_KEY;
  const secret = process.env.OKX_API_SECRET;
  const passphrase = process.env.OKX_API_PASSPHRASE;
  if (!key || !secret || !passphrase) {
    throw new SourceUnavailableError(
      "OKX_API_KEY / OKX_API_SECRET / OKX_API_PASSPHRASE not configured",
    );
  }
  return { key, secret, passphrase };
}

async function okxGet<T>(requestPath: string): Promise<T> {
  const { key, secret, passphrase } = credentials();
  const timestamp = new Date().toISOString();
  const sign = createHmac("sha256", secret)
    .update(`${timestamp}GET${requestPath}`)
    .digest("base64");
  const res = await fetch(`${BASE}${requestPath}`, {
    headers: {
      "OK-ACCESS-KEY": key,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`okx api HTTP ${res.status}`);
  const body = (await res.json()) as { code: string; data: T };
  if (body.code !== "0") throw new Error(`okx api code ${body.code}`);
  return body.data;
}

interface LendingRateSummary {
  ccy: string;
  estRate: string;
}
interface StakingOffer {
  ccy: string;
  apy: string;
  productId: string;
}

export const okxAdapter: Adapter = {
  name: "okx",
  async fetchAll() {
    const results: AdapterResult[] = [];
    const failures: AdapterFailure[] = [];
    const ts = new Date().toISOString();

    for (const [productId, ccy] of Object.entries(OKX_SAVINGS_MAP)) {
      try {
        const data = await okxGet<LendingRateSummary[]>(
          `/api/v5/finance/savings/lending-rate-summary?ccy=${ccy}`,
        );
        const row = data?.[0];
        const est = row ? Number(row.estRate) : NaN;
        if (!row || !Number.isFinite(est)) {
          failures.push({ productId, error: `no lending rate for ${ccy}` });
          continue;
        }
        const apy = est * 100;
        const point: YieldPoint = {
          productId,
          nominalApy: apy,
          baseApy: apy,
          subsidyApy: 0, // 活期奖金部分需单独规则接口，见收录清单 §4.1 待确认项
          rewardApy: 0,
          rewardToken: null,
          tvlUsd: null,
          utilization: null,
          source: "api",
          ts,
        };
        results.push({ productId, point, raw: row });
      } catch (e) {
        failures.push({
          productId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    try {
      const offers = await okxGet<StakingOffer[]>(
        `/api/v5/finance/staking-defi/offers`,
      );
      const eth = (offers ?? []).find((o) => o.ccy === "ETH");
      const apy = eth ? Number(eth.apy) : NaN;
      if (!eth || !Number.isFinite(apy)) {
        failures.push({ productId: OKX_STAKING_PRODUCT, error: "no ETH staking offer" });
      } else {
        const point: YieldPoint = {
          productId: OKX_STAKING_PRODUCT,
          nominalApy: apy,
          baseApy: apy,
          subsidyApy: 0,
          rewardApy: 0,
          rewardToken: null,
          tvlUsd: null,
          utilization: null,
          source: "api",
          ts,
        };
        results.push({ productId: OKX_STAKING_PRODUCT, point, raw: eth });
      }
    } catch (e) {
      failures.push({
        productId: OKX_STAKING_PRODUCT,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return { results, failures };
  },
};
