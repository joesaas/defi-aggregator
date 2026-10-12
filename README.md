# DeFi 投资品聚合推荐网站 — 工程仓库

依据：《产品 PRD》v1.0、《技术架构设计》v1.0、《一期收录清单 v1》（均在目标工作区）。

**架构纪律（不可妥协）**：只读聚合、不碰私钥、不托管资金；每个收益数字必须可溯源（数据源 + 原始快照 + 抓取时间）；上游无数据时如实降级展示，禁止用估算值冒充实时数据。

## 当前状态：第一切片（可运行）

| 层 | 实现 |
|---|---|
| 数据模型 | `src/lib/db.ts`：8 张核心表（platforms / products / raw_snapshots 只追加 / yield_points / yield_estimates / risk_assessments / activities / content_blocks）。本地用 Node 内置 `node:sqlite`，表结构与架构的 PostgreSQL 设计一一对应，repository 函数即接口边界 |
| 采集 | `src/lib/adapters/`：DeFiLlama（协议类 7 个产品实时接入）；Binance SAPI、OKX API v5 签名客户端（凭据走环境变量，未配置时逐产品报失败并降级，**不造数据**）。管道纪律：快照落库 → 异常跳变（±50%）拦截不重算 → 引擎重算估算 |
| 收益引擎 | `src/lib/engines/yield.ts`：公式 v1 = 基础 + 补贴×剩余天数/365 + 奖励×0.7 折价 − Gas 拖累（百分点）；同时输出补贴后落点 |
| 评级引擎 | `src/lib/engines/risk.ts`：六维度打分 + 木桶上限（最弱维度封顶）；引擎只产初评，发布须人工复核（种子评级以《收录清单 v1》评审名义发布 v1） |
| 前台 | 列表页（筛选/评级徽章/新鲜度标识）、详情页（收益拆解、六维评级、「收益从哪来 / 什么情况下会亏」固定文案、`/go` 防钓鱼中转）、活动专区 |
| API | `GET /api/products`、`GET /api/products/{slug}`、`.../yield-history`、`GET /api/activities`、`POST /api/calculator`（区间估算，与列表共用引擎）；响应带 `formula_version` 与 `data_updated_at` |
| 种子 | 《一期收录清单 v1》的 15 个产品、评级种子分与固定文案；seed 时引擎定级与清单结论逐项对账（当前 15/15 一致） |

## 运行

```bash
npm install
npm run seed     # 写入平台/产品/评级/文案（幂等）
npm run ingest   # 拉一轮数据（协议类实时；CEX 需先配凭据，见下）
npm run dev      # http://localhost:3000
npm test         # 双引擎单测
npm run build    # 生产构建
```

CEX 凭据（可选，缺失时对应产品显示「数据源接入中」）：
`BINANCE_API_KEY` / `BINANCE_API_SECRET`；`OKX_API_KEY` / `OKX_API_SECRET` / `OKX_API_PASSPHRASE`。凭据只读权限即可，永不开启提现/交易权限。

## 下一步（按实施计划阶段推进）

1. 阶段 1 余项：Aave 官方 GraphQL 适配器升为主源（DeFiLlama 回到校验源定位）；定时调度（cron 按架构 §7 频率表触发 ingest）；新鲜度看板与同步失败告警；CEX 凭据接入后开启 Binance/OKX 活期与质押数据。
2. 阶段 2 余项：补贴分层明细（Binance/OKX 奖金档位）接入公式摊销；历史曲线页；估算回溯。
3. 阶段 3：对比页（/api/compare）、术语气泡系统、`/go` 中间提示页；运营后台（评级复核发布流、人工录入双人复核）与审计日志。
4. 上线前：迁移 PostgreSQL + Redis、ISR/SEO 完整化、合规审查（实施计划阶段 5）。
