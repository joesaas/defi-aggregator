/**
 * 风险评级引擎（《技术架构设计》§6 / PRD §4.3）。
 *
 * 六维度规则打分产出初评；总评级受最弱维度上限约束（木桶原则），
 * 避免平均分掩盖单项高风险。引擎只产出「初评（draft）」，
 * 评级生效必须经人工复核发布——发布动作不在本模块内。
 */
import type { Grade, RiskDims } from "../types";

export const DIM_LABELS: Record<keyof RiskDims, string> = {
  credit: "平台/协议信用",
  security: "安全历史与审计",
  custody: "托管方式",
  liquidity: "赎回流动性",
  sustainability: "收益可持续性",
  transparency: "数据透明度",
};

const GRADE_ORDER: Grade[] = ["S", "A", "B"];

function minGrade(a: Grade, b: Grade): Grade {
  return GRADE_ORDER[Math.max(GRADE_ORDER.indexOf(a), GRADE_ORDER.indexOf(b))];
}

/** 平均分对应的基础评级 */
function gradeByAverage(avg: number): Grade {
  if (avg >= 80) return "S";
  if (avg >= 65) return "A";
  return "B";
}

/** 木桶上限：最弱维度决定评级天花板 */
function capByWeakest(min: number): Grade {
  if (min >= 70) return "S";
  if (min >= 55) return "A";
  return "B";
}

export interface RiskResult {
  grade: Grade;
  average: number;
  weakestDim: keyof RiskDims;
  weakestScore: number;
  /** 平均分评级被木桶上限压低时为 true（UI 应提示短板） */
  capped: boolean;
}

export function scoreRisk(dims: RiskDims): RiskResult {
  const entries = Object.entries(dims) as [keyof RiskDims, number][];
  const avg = entries.reduce((s, [, v]) => s + v, 0) / entries.length;
  const [weakestDim, weakestScore] = entries.reduce((a, b) =>
    b[1] < a[1] ? b : a,
  );
  const byAvg = gradeByAverage(avg);
  const cap = capByWeakest(weakestScore);
  const grade = minGrade(byAvg, cap);
  return {
    grade,
    average: Math.round(avg * 10) / 10,
    weakestDim,
    weakestScore,
    capped: grade !== byAvg,
  };
}
