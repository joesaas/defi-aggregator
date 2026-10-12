/**
 * 采集脚本：跑一轮全部适配器（见 services/ingest 的纪律说明）。
 * 用法：npm run ingest（生产由定时任务按架构 §7 的频率表触发）。
 */
import { runIngest } from "../src/lib/services/ingest";

async function main() {
  const report = await runIngest();
  console.log(JSON.stringify(report, null, 2));
  if (report.anomalies.length > 0) {
    console.warn(
      `⚠ ${report.anomalies.length} 个产品利率异常跳变，已落库待复核，未重算估算。`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
