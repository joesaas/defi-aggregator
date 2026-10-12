/**
 * 收益计算引擎（《技术架构设计》§5.1 / PRD §4.2）。
 *
 * 标准化实际年化 = base_apy
 *               + subsidy_apy × （补贴剩余天数 / 365）
 *               + reward_apy × discount_factor（默认 0.7）
 *               − feeDrag（Gas 估算 / 参考本金，按参考持有期年化）
 *
 * 补贴同时给出「补贴期内存续年化」与「补贴结束后落点年化」两个值，
 * 禁止把短期补贴按全年外推成单一数字（PRD §4.2）。
 * 列表排序与计算器（F-08）必须共用本引擎同一公式版本。
 */
import { CURRENT_FORMULA, type FormulaConfig } from "../config";

export interface YieldInput {
  baseApy: number;
  subsidyApy?: number;
  /** 补贴剩余天数；未知时传 null（按 0 处理并在结果中标注假设缺失） */
  subsidyRemainingDays?: number | null;
  rewardApy?: number;
  /** 所在链（决定 Gas 估算）；CEX 产品传 null（无链上 Gas） */
  chain: string | null;
}

export interface YieldBreakdown {
  base: number;
  subsidyContribution: number;
  rewardContribution: number;
  feeDrag: number;
}

export interface YieldResult {
  standardizedApy: number;
  postSubsidyApy: number;
  breakdown: YieldBreakdown;
  formulaVersion: string;
  /** true 表示补贴剩余天数未知，补贴贡献按 0 计（保守口径） */
  subsidyAssumptionMissing: boolean;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function computeStandardizedApy(
  input: YieldInput,
  config: FormulaConfig = CURRENT_FORMULA,
): YieldResult {
  const base = input.baseApy;
  const subsidyApy = input.subsidyApy ?? 0;
  const rewardApy = input.rewardApy ?? 0;

  const subsidyAssumptionMissing =
    subsidyApy > 0 && (input.subsidyRemainingDays === null || input.subsidyRemainingDays === undefined);
  const subsidyDays = subsidyAssumptionMissing
    ? 0
    : Math.min(Math.max(input.subsidyRemainingDays ?? 0, 0), 365);
  const subsidyContribution = subsidyApy * (subsidyDays / 365);

  const rewardContribution = rewardApy * config.discountFactor;

  const gasUsd = input.chain ? (config.gasCostUsdByChain[input.chain] ?? 0) : 0;
  // APY 全站以百分数计（6.06 表示 6.06%），故费用拖累换算为百分点：
  // drag(pp) = Gas / 本金 × 100 × （365 / 持有期）
  const feeDrag =
    (gasUsd / config.referencePrincipalUsd) * (365 / config.referenceHoldingDays) * 100;

  const postSubsidyApy = base + rewardContribution - feeDrag;
  const standardizedApy = postSubsidyApy + subsidyContribution;

  return {
    standardizedApy: round4(standardizedApy),
    postSubsidyApy: round4(postSubsidyApy),
    breakdown: {
      base: round4(base),
      subsidyContribution: round4(subsidyContribution),
      rewardContribution: round4(rewardContribution),
      feeDrag: round4(feeDrag),
    },
    formulaVersion: config.version,
    subsidyAssumptionMissing,
  };
}

/**
 * 异常检测（架构 §5.2）：单次利率相对变动超 ±50% 标记待复核，
 * 复核前列表显示旧值 + 「数据核查中」，不直接发布异常值。
 */
export function isAnomalousChange(previousApy: number, nextApy: number): boolean {
  if (previousApy === 0) return nextApy !== 0;
  return Math.abs(nextApy - previousApy) / Math.abs(previousApy) > 0.5;
}
