import { NextResponse } from "next/server";
import { listProductViews } from "@/lib/services/products";
import { CURRENT_FORMULA } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/activities — 活动专区（按结束时间排序；活动期数据逐期录入后生效） */
export async function GET() {
  const views = listProductViews({ type: "activity" });
  return NextResponse.json({
    data: views.map((v) => ({
      id: v.product.id,
      platform: v.platform.name,
      name: v.product.name,
      asset: v.product.asset,
      grade: v.risk?.grade ?? null,
      rationale: v.risk?.rationale ?? null,
      freshness: v.freshness,
      data_updated_at: v.dataUpdatedAt,
    })),
    formula_version: CURRENT_FORMULA.version,
    data_updated_at: null,
  });
}
