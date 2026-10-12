import { describe, expect, it } from "vitest";
import { computeStandardizedApy, isAnomalousChange } from "@/lib/engines/yield";
import { scoreRisk } from "@/lib/engines/risk";

describe("computeStandardizedApy", () => {
  it("纯基础收益（CEX 活期，无 Gas）直接透传", () => {
    const r = computeStandardizedApy({ baseApy: 3.5, chain: null });
    expect(r.standardizedApy).toBe(3.5);
    expect(r.postSubsidyApy).toBe(3.5);
    expect(r.breakdown.feeDrag).toBe(0);
  });

  it("奖励代币按 0.7 折价计入", () => {
    const r = computeStandardizedApy({ baseApy: 4, rewardApy: 2, chain: null });
    expect(r.breakdown.rewardContribution).toBe(1.4);
    expect(r.standardizedApy).toBe(5.4);
  });

  it("费用拖累以百分点计：以太坊 $15 Gas / $10,000 本金 = 0.15pp", () => {
    const r = computeStandardizedApy({ baseApy: 5, chain: "Ethereum" });
    expect(r.breakdown.feeDrag).toBe(0.15);
    expect(r.standardizedApy).toBe(4.85);
    const base = computeStandardizedApy({ baseApy: 5, chain: "Base" });
    expect(base.breakdown.feeDrag).toBe(0.005);
  });

  it("补贴按剩余天数摊销，且给出补贴后落点", () => {
    const r = computeStandardizedApy({
      baseApy: 3, subsidyApy: 4, subsidyRemainingDays: 90, chain: null,
    });
    expect(r.breakdown.subsidyContribution).toBeCloseTo((4 * 90) / 365, 4);
    expect(r.postSubsidyApy).toBe(3);
    expect(r.standardizedApy).toBeCloseTo(3 + (4 * 90) / 365, 4);
  });

  it("补贴天数未知时保守按 0 计并标注假设缺失", () => {
    const r = computeStandardizedApy({
      baseApy: 3, subsidyApy: 4, subsidyRemainingDays: null, chain: null,
    });
    expect(r.breakdown.subsidyContribution).toBe(0);
    expect(r.subsidyAssumptionMissing).toBe(true);
  });
});

describe("isAnomalousChange", () => {
  it("相对变动超 ±50% 判异常", () => {
    expect(isAnomalousChange(4, 7)).toBe(true);
    expect(isAnomalousChange(4, 1.9)).toBe(true);
    expect(isAnomalousChange(4, 5)).toBe(false);
    expect(isAnomalousChange(0, 0)).toBe(false);
    expect(isAnomalousChange(0, 1)).toBe(true);
  });
});

describe("scoreRisk 木桶原则", () => {
  const high = {
    credit: 90, security: 90, custody: 90, liquidity: 90,
    sustainability: 90, transparency: 90,
  };
  it("六维俱高 → S", () => {
    expect(scoreRisk(high).grade).toBe("S");
  });
  it("均分达 S 但单维 62 → 木桶压到 A（Aave DAI 种子形态）", () => {
    const r = scoreRisk({ ...high, credit: 88, security: 84, custody: 88, liquidity: 62, sustainability: 80, transparency: 92 });
    expect(r.average).toBeGreaterThanOrEqual(80);
    expect(r.grade).toBe("A");
    expect(r.capped).toBe(true);
    expect(r.weakestDim).toBe("liquidity");
  });
  it("单维低于 55 → 上限 B", () => {
    const r = scoreRisk({ ...high, sustainability: 40 });
    expect(r.grade).toBe("B");
  });
  it("整体中等 → A", () => {
    const r = scoreRisk({
      credit: 70, security: 70, custody: 70, liquidity: 70,
      sustainability: 70, transparency: 70,
    });
    expect(r.grade).toBe("A");
  });
});
