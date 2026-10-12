import { NextResponse } from "next/server";
import { getProduct, latestYieldPoint } from "@/lib/db";
import { computeStandardizedApy } from "@/lib/engines/yield";
import { CURRENT_FORMULA } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/calculator — 收益计算（PRD F-08）。
 * 与列表共用同一收益引擎、同一公式版本（架构 §5.1）；
 * 输出区间：基准情形 ± 奖励代币价格 ±30% 情形；链上产品另扣一次往返 Gas。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    product_id?: string;
    amount_usd?: number;
    holding_days?: number;
  } | null;
  if (!body?.product_id || !body.amount_usd || !body.holding_days) {
    return NextResponse.json(
      { error: "product_id, amount_usd, holding_days are required" },
      { status: 400 },
    );
  }
  const product = getProduct(body.product_id);
  const point = latestYieldPoint(body.product_id);
  if (!product || !point) {
    return NextResponse.json(
      { error: "product or yield data not available" },
      { status: 404 },
    );
  }
  const { amount_usd: amount, holding_days: days } = body;
  const gasUsd = product.chain
    ? (CURRENT_FORMULA.gasCostUsdByChain[product.chain] ?? 0)
    : 0;

  const scenario = (rewardScale: number) => {
    const r = computeStandardizedApy(
      {
        baseApy: point.baseApy,
        subsidyApy: point.subsidyApy,
        subsidyRemainingDays: days,
        rewardApy: point.rewardApy * rewardScale,
        chain: product.chain,
      },
      // 计算器按用户实际本金算费用拖累，与列表的参考本金口径分开标注
      { ...CURRENT_FORMULA, referencePrincipalUsd: amount, referenceHoldingDays: days },
    );
    const gross = amount * (r.standardizedApy / 100) * (days / 365);
    return {
      standardized_apy: r.standardizedApy,
      projected_return_usd: Math.round((gross - gasUsd) * 100) / 100,
    };
  };

  return NextResponse.json({
    data: {
      product_id: product.id,
      amount_usd: amount,
      holding_days: days,
      gas_usd: gasUsd,
      base: scenario(1),
      low: scenario(0.7), // 奖励代币价格 −30%
      high: scenario(1.3), // 奖励代币价格 +30%
      assumptions:
        "区间由奖励代币价格 ±30% 情形构成；补贴按持有期内存续摊销；链上产品已扣一次申购+赎回 Gas 估算。收益为估算，不构成承诺。",
    },
    formula_version: CURRENT_FORMULA.version,
    data_updated_at: point.ts,
  });
}
