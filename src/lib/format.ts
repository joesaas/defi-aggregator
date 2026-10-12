import type { Freshness } from "./types";

export const fmtPct = (n: number | null | undefined): string =>
  n == null ? "—" : `${n.toFixed(2)}%`;

export function hoursAgo(ts: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 3600_000));
}

export function freshnessLabel(f: Freshness, updatedAt: string | null): string {
  switch (f) {
    case "fresh":
      return "数据新鲜（2 小时内）";
    case "stale":
      return updatedAt ? `数据更新于 ${hoursAgo(updatedAt)} 小时前` : "数据延迟";
    case "expired":
      return "数据已过期，估算值已下线";
    case "none":
      return "数据源接入中，暂无利率数据";
  }
}

export const TYPE_LABELS: Record<string, string> = {
  flexible: "活期",
  fixed: "定期",
  staking: "质押",
  lending: "借贷供给",
  activity: "活动",
};
