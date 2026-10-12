import { NextResponse } from "next/server";
import { listProductViews } from "@/lib/services/products";
import { CURRENT_FORMULA } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/products — 列表+筛选+排序（架构 §8） */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const views = listProductViews({
    asset: url.searchParams.get("asset") ?? undefined,
    platformId: url.searchParams.get("platform") ?? undefined,
    grade: url.searchParams.get("grade") ?? undefined,
    type: url.searchParams.get("term_type") ?? undefined,
    access: url.searchParams.get("access") ?? undefined,
  });
  // sort=standardized_apy 为默认排序（服务层已实现）；其余排序后续迭代
  return NextResponse.json({
    data: views.map((v) => ({
      id: v.product.id,
      platform: v.platform.name,
      platform_id: v.product.platformId,
      name: v.product.name,
      asset: v.product.asset,
      type: v.product.type,
      chain: v.product.chain,
      grade: v.risk?.grade ?? null,
      nominal_apy: v.latestYield?.nominalApy ?? null,
      standardized_apy: v.estimate?.standardizedApy ?? null,
      freshness: v.freshness,
      data_updated_at: v.dataUpdatedAt,
    })),
    formula_version: CURRENT_FORMULA.version,
    data_updated_at: views.reduce<string | null>(
      (max, v) =>
        v.dataUpdatedAt && (!max || v.dataUpdatedAt > max) ? v.dataUpdatedAt : max,
      null,
    ),
  });
}
