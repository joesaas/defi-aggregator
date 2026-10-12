import { listProductViews } from "@/lib/services/products";
import { fmtPct, freshnessLabel, TYPE_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

const ASSETS = ["USDT", "USDC", "ETH", "BTC"];
const GRADES = ["S", "A"];

export default async function HomePage(props: {
  searchParams: Promise<{ asset?: string; grade?: string }>;
}) {
  const sp = await props.searchParams;
  const views = listProductViews({ asset: sp.asset, grade: sp.grade });

  const chip = (label: string, href: string, on: boolean) => (
    <a key={label + href} href={href} className={on ? "on" : ""}>
      {label}
    </a>
  );
  const qs = (patch: Record<string, string | undefined>) => {
    const m = new URLSearchParams();
    const merged = { asset: sp.asset, grade: sp.grade, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) m.set(k, v);
    const s = m.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <h1>高安全性 DeFi 投资品，统一口径比较</h1>
      <p className="lede">
        只收头部交易所与头部协议（白名单准入）；年化为标准化实际年化：奖励代币按 0.7
        折价、补贴按剩余天数摊销、链上产品已扣 Gas 估算。与平台标示值不同，详见各产品详情页的收益拆解。
      </p>
      <div className="filters">
        {chip("全部币种", qs({ asset: undefined }), !sp.asset)}
        {ASSETS.map((a) => chip(a, qs({ asset: a }), sp.asset === a))}
        {chip("全部评级", qs({ grade: undefined }), !sp.grade)}
        {GRADES.map((g) => chip(`${g} 级`, qs({ grade: g }), sp.grade === g))}
      </div>
      {views.map((v) => (
        <div className="card" key={v.product.id}>
          <div>
            <h3>
              {v.risk && <span className={`grade ${v.risk.grade}`}>{v.risk.grade}</span>}
              <a href={`/products/${v.product.id}`}>
                {v.platform.name} · {v.product.name} · {v.product.asset}
              </a>
            </h3>
            <div className="meta">
              {TYPE_LABELS[v.product.type]}
              {v.product.chain ? ` · ${v.product.chain}` : " · 交易所内"}
              {" · "}
              {v.product.redeemEta}
              {v.risk && (
                <>
                  <br />
                  {v.risk.rationale}
                </>
              )}
            </div>
          </div>
          <div className="apy">
            {v.estimate ? (
              <>
                <div className="big mono">{fmtPct(v.estimate.standardizedApy)}</div>
                <div className="lbl">标准化实际年化（公式 {v.estimate.formulaVersion}）</div>
                {v.latestYield && (
                  <div className="lbl">
                    平台标示 {fmtPct(v.latestYield.nominalApy)}
                  </div>
                )}
              </>
            ) : v.latestYield ? (
              <>
                <div className="big mono">{fmtPct(v.latestYield.nominalApy)}</div>
                <div className="lbl">平台标示年化（估算已下线）</div>
              </>
            ) : (
              <>
                <div className="big">—</div>
                <div className="lbl">暂无利率数据</div>
              </>
            )}
            <div className={`fresh ${v.freshness}`}>
              {freshnessLabel(v.freshness, v.dataUpdatedAt)}
            </div>
          </div>
        </div>
      ))}
      {views.length === 0 && <p className="lede">没有符合筛选条件的产品。</p>}
    </>
  );
}
