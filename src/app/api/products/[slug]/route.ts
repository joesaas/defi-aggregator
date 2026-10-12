import { NextResponse } from "next/server";
import { getProductView } from "@/lib/services/products";
import { CURRENT_FORMULA } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/products/{slug} — 详情：收益拆解、评级明细、固定文案 */
export async function GET(
  _req: Request,
  props: { params: Promise<{ slug: string }> },
) {
  const { slug } = await props.params;
  const view = getProductView(slug);
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    data: {
      id: view.product.id,
      platform: view.platform.name,
      name: view.product.name,
      asset: view.product.asset,
      type: view.product.type,
      chain: view.product.chain,
      redeem_eta: view.product.redeemEta,
      min_amount: view.product.minAmount,
      access: view.product.access,
      kyc_required: view.product.kycRequired,
      official_url: view.product.officialUrl,
      latest_yield: view.latestYield,
      estimate: view.estimate,
      risk: view.risk,
      content_blocks: view.contentBlocks,
      freshness: view.freshness,
    },
    formula_version: CURRENT_FORMULA.version,
    data_updated_at: view.dataUpdatedAt,
  });
}
