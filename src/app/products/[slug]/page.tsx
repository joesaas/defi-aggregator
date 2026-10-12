import { notFound } from "next/navigation";
import { getProductView } from "@/lib/services/products";
import { computeStandardizedApy } from "@/lib/engines/yield";
import { DIM_LABELS, scoreRisk } from "@/lib/engines/risk";
import { fmtPct, freshnessLabel, TYPE_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProductPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const view = getProductView(slug);
  if (!view) notFound();
  const { product, platform, latestYield, estimate, risk } = view;

  const breakdown = latestYield
    ? computeStandardizedApy({
        baseApy: latestYield.baseApy,
        subsidyApy: latestYield.subsidyApy,
        subsidyRemainingDays: null,
        rewardApy: latestYield.rewardApy,
        chain: product.chain,
      })
    : null;
  const riskResult = risk ? scoreRisk(risk.dims) : null;
  const yieldBlock = view.contentBlocks.find((b) => b.kind === "yield_source");
  const lossBlock = view.contentBlocks.find((b) => b.kind === "loss_scenarios");

  return (
    <>
      <h1>
        {risk && <span className={`grade ${risk.grade}`}>{risk.grade}</span>}
        {platform.name} · {product.name} · {product.asset}
      </h1>
      <p className="lede">
        {TYPE_LABELS[product.type]}
        {product.chain ? ` · ${product.chain}` : " · 交易所内"} · {product.redeemEta}
        {" · "}
        <span className={`fresh ${view.freshness}`}>
          {freshnessLabel(view.freshness, view.dataUpdatedAt)}
        </span>
      </p>

      <div className="panel">
        <h2>收益拆解（标准化实际年化）</h2>
        {latestYield && breakdown && estimate ? (
          <table className="kv">
            <tbody>
              <tr><td className="k">平台标示年化</td><td className="mono">{fmtPct(latestYield.nominalApy)}</td></tr>
              <tr><td className="k">基础收益（借贷利息/质押奖励）</td><td className="mono">{fmtPct(breakdown.breakdown.base)}</td></tr>
              <tr><td className="k">奖励代币部分（×0.7 折价）</td><td className="mono">{fmtPct(breakdown.breakdown.rewardContribution)}</td></tr>
              <tr><td className="k">Gas 费用拖累估算</td><td className="mono">−{fmtPct(breakdown.breakdown.feeDrag)}</td></tr>
              <tr><td className="k"><strong>标准化实际年化</strong></td><td className="mono"><strong>{fmtPct(estimate.standardizedApy)}</strong></td></tr>
              <tr><td className="k">数据来源 / 抓取时间</td><td>{latestYield.source} · {new Date(latestYield.ts).toLocaleString("zh-CN")}</td></tr>
            </tbody>
          </table>
        ) : (
          <p>该产品的数据源尚在接入中（需平台 API 凭据），暂不展示收益数字——本站不以估算值冒充实时数据。产品要点与风险评级见下。</p>
        )}
      </div>

      {risk && riskResult && (
        <div className="panel">
          <h2>风险评级：{risk.grade} 级（v{risk.version}，{risk.reviewer}复核发布）</h2>
          <p>{risk.rationale}</p>
          {(Object.entries(risk.dims) as [keyof typeof risk.dims, number][]).map(
            ([dim, score]) => (
              <div
                className={`dim ${dim === riskResult.weakestDim ? "weak" : ""}`}
                key={dim}
              >
                <span className="name">{DIM_LABELS[dim]}</span>
                <span className="bar"><i style={{ width: `${score}%` }} /></span>
                <span className="mono">{score}</span>
                {dim === riskResult.weakestDim && <span>← 短板（木桶）</span>}
              </div>
            ),
          )}
        </div>
      )}

      <div className="panel">
        <h2>收益从哪来</h2>
        <p>{yieldBlock?.body ?? "待补充。"}</p>
        <h2 style={{ marginTop: 16 }}>什么情况下会亏</h2>
        <p>{lossBlock?.body ?? "待补充。"}</p>
      </div>

      <div className="panel">
        <h2>产品要点</h2>
        <table className="kv">
          <tbody>
            <tr><td className="k">参与方式</td><td>{product.access === "exchange" ? "交易所账户内参与" : "链上钱包自托管参与"}</td></tr>
            <tr><td className="k">是否需要 KYC</td><td>{product.kycRequired ? "需要（平台强制）" : "不需要"}</td></tr>
            <tr><td className="k">最低金额</td><td>{product.minAmount ?? "官方未公开，参与前在官方页面确认"}</td></tr>
            <tr><td className="k">赎回时效</td><td>{product.redeemEta}</td></tr>
            {latestYield?.tvlUsd != null && (
              <tr><td className="k">池规模（数据源快照）</td><td className="mono">${Math.round(latestYield.tvlUsd).toLocaleString()}</td></tr>
            )}
          </tbody>
        </table>
        <p style={{ marginTop: 14 }}>
          <a className="btn" href={`/go/${product.id}`}>
            前往 {platform.name} 官方页面 →
          </a>
        </p>
        <p className="meta">本站只做建议，不代客投资；点击将经本站中转跳往官方页面，请核对域名防钓鱼。</p>
      </div>
    </>
  );
}
