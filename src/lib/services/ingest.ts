/**
 * 采集管道（《技术架构设计》§2/§5.2/§7）：
 * 适配器拉取 → 原始快照只追加落库 → 标准化收益点落库 → 收益引擎重算估算。
 *
 * 纪律：
 * - 每个适配器独立失败域，单源故障不阻塞其他源；失败只记报告，不造数据；
 * - 利率异常跳变（±50%）的收益点照常落库溯源，但**不重算估算**，
 *   前台继续展示旧估算并标记待复核（报告 anomalies 字段）。
 */
import {
  appendRawSnapshot,
  getProduct,
  insertYieldEstimate,
  insertYieldPoint,
  latestYieldPoint,
} from "../db";
import { CURRENT_FORMULA } from "../config";
import { computeStandardizedApy, isAnomalousChange } from "../engines/yield";
import { defillamaAdapter } from "../adapters/defillama";
import { binanceAdapter } from "../adapters/binance";
import { okxAdapter } from "../adapters/okx";
import type { Adapter } from "../adapters/types";

export interface IngestReport {
  startedAt: string;
  updated: string[]; // 成功更新估算的产品
  anomalies: { productId: string; previousApy: number; nextApy: number }[];
  failures: { source: string; productId: string; error: string }[];
}

const ADAPTERS: Adapter[] = [defillamaAdapter, binanceAdapter, okxAdapter];

export async function runIngest(): Promise<IngestReport> {
  const report: IngestReport = {
    startedAt: new Date().toISOString(),
    updated: [],
    anomalies: [],
    failures: [],
  };

  for (const adapter of ADAPTERS) {
    let outcome;
    try {
      outcome = await adapter.fetchAll();
    } catch (e) {
      report.failures.push({
        source: adapter.name,
        productId: "*",
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    for (const f of outcome.failures) {
      report.failures.push({ source: adapter.name, ...f });
    }
    for (const { productId, point, raw } of outcome.results) {
      appendRawSnapshot(adapter.name, productId, raw);
      const prev = latestYieldPoint(productId);
      insertYieldPoint(point);
      if (prev && isAnomalousChange(prev.nominalApy, point.nominalApy)) {
        report.anomalies.push({
          productId,
          previousApy: prev.nominalApy,
          nextApy: point.nominalApy,
        });
        continue; // 待人工复核：不重算估算
      }
      const product = getProduct(productId);
      const result = computeStandardizedApy({
        baseApy: point.baseApy,
        subsidyApy: point.subsidyApy,
        subsidyRemainingDays: null,
        rewardApy: point.rewardApy,
        chain: product?.chain ?? null,
      });
      insertYieldEstimate({
        productId,
        standardizedApy: result.standardizedApy,
        postSubsidyApy: result.postSubsidyApy,
        discountFactor: CURRENT_FORMULA.discountFactor,
        formulaVersion: result.formulaVersion,
        computedAt: new Date().toISOString(),
      });
      report.updated.push(productId);
    }
  }
  return report;
}
