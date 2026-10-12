/**
 * 统一数据模型（《技术架构设计》§4 的代码形态）。
 * 所有外部数据源经适配器映射到这里的类型后，才进入标准化与计算层。
 */

export type PlatformType = "cex" | "protocol";
export type ProductType = "flexible" | "fixed" | "staking" | "lending" | "activity";
export type AccessType = "exchange" | "onchain";
export type Grade = "S" | "A" | "B";
export type SourceType = "api" | "subgraph" | "aggregator" | "manual" | "unavailable";

export interface Platform {
  id: string; // slug, e.g. "binance"
  name: string;
  type: PlatformType;
  website: string;
  status: "active" | "suspended";
}

export interface Product {
  id: string; // slug, e.g. "binance-simple-earn-usdt"
  platformId: string;
  name: string;
  asset: string; // 币种，如 USDT / ETH / WETH
  type: ProductType;
  chain: string | null; // 链上产品所在链，如 Ethereum / Base；CEX 产品为 null
  termDays: number | null; // null = 活期
  redeemEta: string; // 赎回时效说明（展示口径）
  minAmount: string | null; // 最低参与金额（展示口径，如 "0.01 USDT"）；未核实为 null
  access: AccessType;
  kycRequired: boolean;
  officialUrl: string; // 官方产品页（/go 跳转目标）
  status: "active" | "delisted";
}

/** 标准化后的收益时序点（架构表 yield_points） */
export interface YieldPoint {
  productId: string;
  /** 平台/协议标示年化（%），原文口径 */
  nominalApy: number;
  /** 基础收益年化（%）：借贷利息、质押共识收益等真实收益部分 */
  baseApy: number;
  /** 补贴年化（%）：平台补贴/分层奖金部分，可为 0 */
  subsidyApy: number;
  /** 奖励代币年化（%）：以奖励代币计价的部分，可为 0 */
  rewardApy: number;
  rewardToken: string | null;
  /** 池规模（USD），来源有提供时记录 */
  tvlUsd: number | null;
  /** 利用率（0-1），借贷类产品有此字段 */
  utilization: number | null;
  source: SourceType;
  ts: string; // ISO 时间
}

/** 收益引擎输出（架构表 yield_estimates），带公式版本，可重算 */
export interface YieldEstimate {
  productId: string;
  standardizedApy: number;
  /** 补贴结束后的落点年化（%）；无补贴时等于 standardizedApy */
  postSubsidyApy: number;
  discountFactor: number;
  formulaVersion: string;
  computedAt: string;
}

/** 风险评级六维度（架构 §6），每维 0-100 */
export interface RiskDims {
  /** 平台/协议信用 */
  credit: number;
  /** 安全历史与审计 */
  security: number;
  /** 托管方式（自托管/合约托管优于平台托管） */
  custody: number;
  /** 赎回流动性 */
  liquidity: number;
  /** 收益可持续性 */
  sustainability: number;
  /** 数据透明度 */
  transparency: number;
}

export interface RiskAssessment {
  productId: string;
  grade: Grade;
  dims: RiskDims;
  rationale: string; // 一句话理由（PRD 要求）
  reviewer: string;
  status: "draft" | "published";
  version: number;
  publishedAt: string | null;
}

export interface ContentBlock {
  productId: string;
  kind: "yield_source" | "loss_scenarios"; // 收益从哪来 / 什么情况下会亏（PRD D6）
  body: string;
  updatedBy: string;
  updatedAt: string;
}

export type Freshness = "fresh" | "stale" | "expired" | "none";

/** 前台/API 的产品聚合视图 */
export interface ProductView {
  product: Product;
  platform: Platform;
  latestYield: YieldPoint | null;
  estimate: YieldEstimate | null;
  risk: RiskAssessment | null;
  freshness: Freshness;
  dataUpdatedAt: string | null;
}
