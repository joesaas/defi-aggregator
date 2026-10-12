/**
 * 前台/API 读服务：前端只读本地库，永不在请求路径上直连上游（架构 §2）。
 * 新鲜度 SLA（§7）在这里执行：>24h 的估算值自动下线（estimate 置 null），
 * 页面据 freshness 展示「数据更新于 X 前」或「数据源接入中」。
 */
import {
  getProduct,
  latestEstimate,
  latestPublishedRisk,
  latestYieldPoint,
  listContentBlocks,
  listPlatforms,
  listProducts,
  yieldHistory,
} from "../db";
import {
  CURRENT_FORMULA,
  FRESHNESS_EXPIRED_MS,
  FRESHNESS_FRESH_MS,
} from "../config";
import type { Freshness, ProductView, YieldPoint } from "../types";

export function freshnessOf(ts: string | null): Freshness {
  if (!ts) return "none";
  const age = Date.now() - new Date(ts).getTime();
  if (age <= FRESHNESS_FRESH_MS) return "fresh";
  if (age <= FRESHNESS_EXPIRED_MS) return "stale";
  return "expired";
}

function toView(productId: string): ProductView | null {
  const product = getProduct(productId);
  if (!product) return null;
  const platforms = listPlatforms();
  const platform = platforms.find((p) => p.id === product.platformId);
  if (!platform) return null;
  const latestYield = latestYieldPoint(productId);
  const freshness = freshnessOf(latestYield?.ts ?? null);
  // SLA：超 24h 未更新，估算值下线（只保留名义信息与过期标识）
  const estimate =
    freshness === "expired"
      ? null
      : latestEstimate(productId, CURRENT_FORMULA.version);
  return {
    product,
    platform,
    latestYield,
    estimate,
    risk: latestPublishedRisk(productId),
    freshness,
    dataUpdatedAt: latestYield?.ts ?? null,
  };
}

export interface ProductFilters {
  asset?: string;
  platformId?: string;
  grade?: string;
  type?: string;
  access?: string;
}

export function listProductViews(filters: ProductFilters = {}): ProductView[] {
  let views = listProducts()
    .map((p) => toView(p.id))
    .filter((v): v is ProductView => v !== null);
  if (filters.asset) views = views.filter((v) => v.product.asset === filters.asset);
  if (filters.platformId)
    views = views.filter((v) => v.product.platformId === filters.platformId);
  if (filters.grade) views = views.filter((v) => v.risk?.grade === filters.grade);
  if (filters.type) views = views.filter((v) => v.product.type === filters.type);
  if (filters.access) views = views.filter((v) => v.product.access === filters.access);
  // 默认排序：有标准化年化者按年化降序在前，其余按平台与名称
  views.sort((a, b) => {
    const av = a.estimate?.standardizedApy;
    const bv = b.estimate?.standardizedApy;
    if (av != null && bv != null) return bv - av;
    if (av != null) return -1;
    if (bv != null) return 1;
    return a.product.id.localeCompare(b.product.id);
  });
  return views;
}

export function getProductView(productId: string) {
  const view = toView(productId);
  if (!view) return null;
  return {
    ...view,
    contentBlocks: listContentBlocks(productId),
    history: yieldHistory(productId, 30),
  };
}

export function getYieldHistory(productId: string, days: number): YieldPoint[] {
  return yieldHistory(productId, days);
}
