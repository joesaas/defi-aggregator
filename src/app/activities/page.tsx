import { listProductViews } from "@/lib/services/products";
import { fmtPct, freshnessLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function ActivitiesPage() {
  const views = listProductViews({ type: "activity" });
  return (
    <>
      <h1>活动专区</h1>
      <p className="lede">
        活动类产品逐期上架：必须有明确起止与完整规则，结束后 24 小时内下架。每条都标注活动结束后的资金落点，禁止与常驻理财混排。
      </p>
      {views.map((v) => (
        <div className="card" key={v.product.id}>
          <div>
            <h3>
              {v.risk && <span className={`grade ${v.risk.grade}`}>{v.risk.grade}</span>}
              <a href={`/products/${v.product.id}`}>
                {v.platform.name} · {v.product.name}
              </a>
            </h3>
            <div className="meta">
              参与资产 {v.product.asset} · {v.product.redeemEta}
              <br />
              {v.risk?.rationale}
            </div>
          </div>
          <div className="apy">
            <div className="big">{v.latestYield ? fmtPct(v.latestYield.nominalApy) : "逐期公告"}</div>
            <div className="lbl">活动制，无常驻利率</div>
            <div className={`fresh ${v.freshness}`}>
              {freshnessLabel(v.freshness, v.dataUpdatedAt)}
            </div>
          </div>
        </div>
      ))}
      {views.length === 0 && <p className="lede">当前没有在架活动。</p>}
    </>
  );
}
