/**
 * 种子脚本：写入平台/产品主数据、PRD 固定文案，并以评级引擎计算初评，
 * 与《一期收录清单 v1》结论对账后以「已发布 v1」落库（复核人记为清单评审）。
 * 幂等：可重复运行；已有 published v1 的产品不重复插入评级。
 */
import {
  getDb,
  insertRiskAssessment,
  latestPublishedRisk,
  upsertContentBlock,
  upsertPlatform,
  upsertProduct,
} from "../src/lib/db";
import { PLATFORMS, SEED_PRODUCTS } from "../src/lib/seed/data";
import { scoreRisk } from "../src/lib/engines/risk";

function main() {
  getDb(); // 初始化 schema
  for (const p of PLATFORMS) upsertPlatform(p);

  let mismatches = 0;
  for (const seed of SEED_PRODUCTS) {
    upsertProduct(seed.product);
    const now = new Date().toISOString();
    upsertContentBlock({
      productId: seed.product.id, kind: "yield_source", body: seed.yieldSource,
      updatedBy: "seed:checklist-v1", updatedAt: now,
    });
    upsertContentBlock({
      productId: seed.product.id, kind: "loss_scenarios", body: seed.lossScenarios,
      updatedBy: "seed:checklist-v1", updatedAt: now,
    });

    const result = scoreRisk(seed.dims);
    const mark = result.grade === seed.expectedGrade ? "✓" : "✗ 不一致";
    if (result.grade !== seed.expectedGrade) mismatches++;
    console.log(
      `${seed.product.id}: 引擎初评 ${result.grade}（均分 ${result.average}，短板 ${result.weakestDim}=${result.weakestScore}${result.capped ? "，木桶压级" : ""}） 清单结论 ${seed.expectedGrade} ${mark}`,
    );

    if (!latestPublishedRisk(seed.product.id)) {
      insertRiskAssessment({
        productId: seed.product.id,
        grade: result.grade,
        dims: seed.dims,
        rationale: seed.rationale,
        reviewer: "清单 v1 评审",
        status: "published",
        version: 1,
        publishedAt: now,
      });
    }
  }
  console.log(
    `\n种子完成：${PLATFORMS.length} 个平台、${SEED_PRODUCTS.length} 个产品；评级对账不一致 ${mismatches} 项。`,
  );
  if (mismatches > 0) process.exitCode = 1;
}

main();
