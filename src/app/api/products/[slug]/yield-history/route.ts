import { NextResponse } from "next/server";
import { getYieldHistory } from "@/lib/services/products";
import { CURRENT_FORMULA } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/products/{slug}/yield-history?range=30d|90d */
export async function GET(
  req: Request,
  props: { params: Promise<{ slug: string }> },
) {
  const { slug } = await props.params;
  const range = new URL(req.url).searchParams.get("range") ?? "30d";
  const days = range === "90d" ? 90 : 30;
  const points = getYieldHistory(slug, days);
  return NextResponse.json({
    data: points.map((p) => ({
      ts: p.ts,
      nominal_apy: p.nominalApy,
      base_apy: p.baseApy,
      reward_apy: p.rewardApy,
    })),
    formula_version: CURRENT_FORMULA.version,
    data_updated_at: points.at(-1)?.ts ?? null,
  });
}
