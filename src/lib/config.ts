/**
 * 版本化公式配置（《技术架构设计》§5.1）。
 * 参数变更必须发新版本（新增条目）并全量重算，历史估算保留旧版本结果。
 */
export interface FormulaConfig {
  version: string;
  /** 奖励代币折价系数（PRD §4.2 默认 0.7） */
  discountFactor: number;
  /** 费用拖累的参考本金（USD）：feeDrag = 年化 Gas 成本 / 参考本金 */
  referencePrincipalUsd: number;
  /** 参考持有期（天） */
  referenceHoldingDays: number;
  /** 各链一次申购+赎回的 Gas 成本估算（USD）；CEX 内部操作为 0 */
  gasCostUsdByChain: Record<string, number>;
}

export const FORMULA_V1: FormulaConfig = {
  version: "v1",
  discountFactor: 0.7,
  referencePrincipalUsd: 10_000,
  referenceHoldingDays: 365,
  gasCostUsdByChain: {
    Ethereum: 15,
    Base: 0.5,
  },
};

export const CURRENT_FORMULA = FORMULA_V1;

/** 新鲜度 SLA（架构 §7）：≤2h 新鲜；>24h 下线估算值 */
export const FRESHNESS_FRESH_MS = 2 * 3600_000;
export const FRESHNESS_EXPIRED_MS = 24 * 3600_000;

/** 异常检测阈值（架构 §5.2）：单次利率相对变动超 ±50% 标记待复核 */
export const ANOMALY_RELATIVE_CHANGE = 0.5;
