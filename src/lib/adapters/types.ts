import type { YieldPoint } from "../types";

/** 适配器统一输出：一条已归一化的收益点 + 对应的原始负载（进 raw_snapshots 溯源） */
export interface AdapterResult {
  productId: string;
  point: YieldPoint;
  raw: unknown;
}

export interface AdapterFailure {
  productId: string;
  error: string;
}

export interface Adapter {
  /** 快照 source 标识，如 defillama / binance / okx */
  name: string;
  fetchAll(): Promise<{ results: AdapterResult[]; failures: AdapterFailure[] }>;
}

/** 数据源未配置/不可用（如缺 API Key）。采集层据此标记新鲜度降级，不伪造数据。 */
export class SourceUnavailableError extends Error {}
