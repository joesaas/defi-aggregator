/**
 * 一期收录清单 v1 的落库形态（来源：《一期收录清单 v1》2026-10-12）。
 * 评级只存六维度种子分与一句话理由，grade 由评级引擎 scoreRisk 计算，
 * 保证「引擎初评 → 人工复核发布」链路口径一致；seed 时与清单结论对账。
 */
import type { Platform, Product, RiskDims } from "../types";

export const PLATFORMS: Platform[] = [
  { id: "binance", name: "Binance", type: "cex", website: "https://www.binance.com", status: "active" },
  { id: "okx", name: "OKX", type: "cex", website: "https://www.okx.com", status: "active" },
  { id: "aave", name: "Aave", type: "protocol", website: "https://aave.com", status: "active" },
  { id: "lido", name: "Lido", type: "protocol", website: "https://lido.fi", status: "active" },
  { id: "compound", name: "Compound", type: "protocol", website: "https://compound.finance", status: "active" },
];

export interface SeedProduct {
  product: Product;
  dims: RiskDims;
  /** 清单 v1 的评级结论，seed 时与引擎计算结果对账 */
  expectedGrade: "S" | "A";
  rationale: string;
  yieldSource: string; // 收益从哪来（PRD D6 固定文案）
  lossScenarios: string; // 什么情况下会亏（PRD D6 固定文案）
}

const cex = (
  p: Partial<Product> & Pick<Product, "id" | "platformId" | "name" | "asset" | "type">,
): Product => ({
  chain: null,
  termDays: null,
  redeemEta: "活期，随存随取",
  minAmount: null,
  access: "exchange",
  kycRequired: true,
  officialUrl: "",
  status: "active",
  ...p,
});

const onchain = (
  p: Partial<Product> & Pick<Product, "id" | "platformId" | "name" | "asset" | "type" | "chain">,
): Product => ({
  termDays: null,
  redeemEta: "无锁定期，池内流动性充足时可即时赎回",
  minAmount: null,
  access: "onchain",
  kycRequired: false,
  officialUrl: "",
  status: "active",
  ...p,
});

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    product: cex({
      id: "binance-simple-earn-usdt", platformId: "binance", name: "Simple Earn 活期", asset: "USDT",
      type: "flexible", redeemEta: "即时赎回至现货账户（有每日赎回限额）", minAmount: "0.01 USDT",
      officialUrl: "https://www.binance.com/en/earn",
    }),
    dims: { credit: 92, security: 82, custody: 75, liquidity: 95, sustainability: 76, transparency: 80 },
    expectedGrade: "S",
    rationale: "头部交易所活期，月度储备证明、历史事故经 SAFU 全额赔付，赎回即时。",
    yieldSource: "平台将申购资金用于借贷等业务产生利息，按实时 APR 计息；部分时段另有平台补贴的分层奖金，仅覆盖小额部分。",
    lossScenarios: "资金托管于平台，核心风险是平台信用与运营风险；补贴到期后利率回落至基础水平；2019 年被盗事件由 SAFU 基金全额赔付，用户无损失。",
  },
  {
    product: cex({
      id: "binance-simple-earn-usdc", platformId: "binance", name: "Simple Earn 活期", asset: "USDC",
      type: "flexible", redeemEta: "即时赎回至现货账户（有每日赎回限额）", minAmount: "0.01 USDC",
      officialUrl: "https://www.binance.com/en/earn",
    }),
    dims: { credit: 92, security: 82, custody: 75, liquidity: 95, sustainability: 76, transparency: 82 },
    expectedGrade: "S",
    rationale: "头部交易所活期，储备证明中 USDC 储备率居前，赎回即时。",
    yieldSource: "同 USDT 活期：平台借贷业务利息（实时 APR）加活动期分层补贴。",
    lossScenarios: "平台信用与运营风险为主；另注意普通档与 VIP 专享档利率不同，补贴到期后利率回落。",
  },
  {
    product: cex({
      id: "binance-simple-earn-btc", platformId: "binance", name: "Simple Earn 活期", asset: "BTC",
      type: "flexible", redeemEta: "即时赎回至现货账户（有每日赎回限额）", minAmount: null,
      officialUrl: "https://www.binance.com/en/earn",
    }),
    dims: { credit: 92, security: 82, custody: 75, liquidity: 95, sustainability: 72, transparency: 80 },
    expectedGrade: "S",
    rationale: "头部交易所活期，机制与稳定币档一致，短板在 BTC 理财收益率偏低。",
    yieldSource: "平台借贷业务利息，BTC 本位计息，利率通常显著低于稳定币产品。",
    lossScenarios: "平台信用风险之外，BTC 本身价格波动独立于产品收益：币本位赚钱不等于法币不亏。",
  },
  {
    product: cex({
      id: "binance-eth-staking-wbeth", platformId: "binance", name: "ETH 质押（WBETH）", asset: "ETH",
      type: "staking", redeemEta: "质押退出有队列因素；WBETH 可在二级市场卖出", minAmount: "0.0001 ETH",
      officialUrl: "https://www.binance.com/en/earn",
    }),
    dims: { credit: 92, security: 82, custody: 75, liquidity: 62, sustainability: 85, transparency: 80 },
    expectedGrade: "A",
    rationale: "收益来自以太坊共识质押奖励、可持续，短板为退出排队与 WBETH 折价风险。",
    yieldSource: "以太坊 PoS 共识质押奖励，申购得 WBETH，奖励经兑换率累积体现。",
    lossScenarios: "赎回走质押退出队列；WBETH 二级市场价格可能偏离兑换率；另有平台托管风险。",
  },
  {
    product: cex({
      id: "binance-launchpool", platformId: "binance", name: "Launchpool", asset: "BNB/FDUSD",
      type: "activity", redeemEta: "活动期内质押，奖励可随时领取，本金可赎回", minAmount: null,
      officialUrl: "https://www.binance.com/en/launchpool",
    }),
    dims: { credit: 92, security: 84, custody: 75, liquidity: 80, sustainability: 58, transparency: 78 },
    expectedGrade: "A",
    rationale: "本金可赎回、规则逐期公示，短板在奖励为新上市代币、收益波动大且活动结束即停止。",
    yieldSource: "新项目方提供的代币发行分配额度，按质押份额挖矿，奖励按小时累计。",
    lossScenarios: "本金风险低，主要风险在奖励代币上市后的价格波动；活动结束收益即停止，资金需自行安排落点。",
  },
  {
    product: cex({
      id: "okx-simple-earn-usdt", platformId: "okx", name: "简单赚币活期", asset: "USDT",
      type: "flexible", redeemEta: "活期，随存随取", minAmount: null,
      officialUrl: "https://www.okx.com/earn",
    }),
    dims: { credit: 88, security: 78, custody: 74, liquidity: 95, sustainability: 76, transparency: 82 },
    expectedGrade: "S",
    rationale: "头部交易所活期，月度储备证明（第 47 期 USDT 储备率 105%），官方 API 完整。",
    yieldSource: "资金出借给杠杆交易与借币用户，利息按出借利率分配；活期奖金部分有金额上限与期限。",
    lossScenarios: "平台信用与运营风险；OKX 2020 年曾暂停提现约 5 周（非黑客事件、无用户资产损失，恢复后有补偿计划）。",
  },
  {
    product: cex({
      id: "okx-simple-earn-usdc", platformId: "okx", name: "简单赚币活期", asset: "USDC",
      type: "flexible", redeemEta: "活期，随存随取", minAmount: null,
      officialUrl: "https://www.okx.com/earn",
    }),
    dims: { credit: 88, security: 78, custody: 74, liquidity: 95, sustainability: 76, transparency: 82 },
    expectedGrade: "S",
    rationale: "头部交易所活期，储备证明覆盖 USDC（第 47 期 100%），官方 API 完整。",
    yieldSource: "同 USDT 活期：出借给杠杆/借币需求方的利息。",
    lossScenarios: "平台信用与运营风险；奖金利率到期后回落至基础出借利率。",
  },
  {
    product: cex({
      id: "okx-onchain-earn-eth", platformId: "okx", name: "链上赚币 ETH 质押", asset: "ETH",
      type: "staking", redeemEta: "按链上协议退出队列，非即时到账", minAmount: null,
      officialUrl: "https://www.okx.com/earn",
    }),
    dims: { credit: 88, security: 76, custody: 70, liquidity: 62, sustainability: 85, transparency: 82 },
    expectedGrade: "A",
    rationale: "经交易所入口的链上质押，API 数据完整，短板为退出排队与链上业务线风险。",
    yieldSource: "ETH 经链上 PoS 协议/验证节点质押产生的协议奖励，由 OKX 聚合接入与分配。",
    lossScenarios: "验证者罚没与链上协议风险；赎回受协议退出队列影响；OKX 链上业务线 2023 年曾发生合约私钥事件（承诺全额承担）。",
  },
  {
    product: onchain({
      id: "aave-v3-usdc-ethereum", platformId: "aave", name: "Aave v3 供给", asset: "USDC",
      type: "lending", chain: "Ethereum", officialUrl: "https://app.aave.com",
    }),
    dims: { credit: 90, security: 84, custody: 88, liquidity: 78, sustainability: 82, transparency: 92 },
    expectedGrade: "S",
    rationale: "借贷利息为真实收益、链上全透明，短板为利用率高位时赎回受流动性约束。",
    yieldSource: "借款人支付的浮动借款利息，按利率模型在供给方与协议储备之间分配。",
    lossScenarios: "智能合约风险；利用率接近 100% 时赎回须等借款人还款；USDC 发行方风险；预言机异常可能引发异常清算（2026-03 事件中受损者为借款人，协议承诺全额赔付）。",
  },
  {
    product: onchain({
      id: "aave-v3-usdt-ethereum", platformId: "aave", name: "Aave v3 供给", asset: "USDT",
      type: "lending", chain: "Ethereum", officialUrl: "https://app.aave.com",
    }),
    dims: { credit: 90, security: 84, custody: 88, liquidity: 78, sustainability: 82, transparency: 92 },
    expectedGrade: "S",
    rationale: "Aave 规模居前的稳定币池（单池约 26.8 亿美元，2026-10 快照），短板同高利用率赎回约束。",
    yieldSource: "借款人支付的浮动借款利息。",
    lossScenarios: "智能合约风险；利用率高位时赎回受限；USDT 发行方（Tether）储备与赎回风险。",
  },
  {
    product: onchain({
      id: "aave-v3-weth-ethereum", platformId: "aave", name: "Aave v3 供给", asset: "WETH",
      type: "lending", chain: "Ethereum", officialUrl: "https://app.aave.com",
    }),
    dims: { credit: 90, security: 82, custody: 88, liquidity: 85, sustainability: 80, transparency: 92 },
    expectedGrade: "S",
    rationale: "Aave v3 最大单资产池，纯供给方未受历史预言机事件影响，事件相关性须完整披露。",
    yieldSource: "WETH 借款人支付的浮动借款利息，利用率通常低于稳定币市场，利率亦较低。",
    lossScenarios: "智能合约风险；ETH 价格波动独立于供给收益（币本位）；2026-03 预言机事故标的即 wstETH/ETH 市场，借款人曾被异常清算（协议无坏账、承诺全额赔付）。",
  },
  {
    product: onchain({
      id: "aave-v3-dai-ethereum", platformId: "aave", name: "Aave v3 供给", asset: "DAI",
      type: "lending", chain: "Ethereum", officialUrl: "https://app.aave.com",
    }),
    dims: { credit: 88, security: 84, custody: 88, liquidity: 62, sustainability: 80, transparency: 92 },
    expectedGrade: "A",
    rationale: "机制与同协议主流池一致，但单池规模显著偏小，流动性短板压级（木桶原则）。",
    yieldSource: "DAI 借款人支付的浮动借款利息。",
    lossScenarios: "单池规模约 1.3 亿美元，大额赎回更易受流动性约束；DAI 为去中心化稳定币，其抵押品结构风险与中心化稳定币不同；智能合约风险。",
  },
  {
    product: onchain({
      id: "aave-v3-usdc-base", platformId: "aave", name: "Aave v3 供给（Base）", asset: "USDC",
      type: "lending", chain: "Base", officialUrl: "https://app.aave.com",
    }),
    dims: { credit: 88, security: 84, custody: 86, liquidity: 68, sustainability: 82, transparency: 90 },
    expectedGrade: "A",
    rationale: "同协议 Base 市场，Gas 成本友好，短板为链与市场深度弱于以太坊主网。",
    yieldSource: "Base 链 Aave 市场借款人支付的浮动借款利息。",
    lossScenarios: "Base 链自身与跨链桥生态风险；市场深度小于主网，高利用率时赎回受限；智能合约风险。",
  },
  {
    product: onchain({
      id: "lido-steth-ethereum", platformId: "lido", name: "ETH 质押（stETH）", asset: "ETH",
      type: "staking", chain: "Ethereum", minAmount: "任意金额（无 32 ETH 门槛）",
      redeemEta: "官方赎回排队（常态约 1–5 天）；或二级市场即时卖出",
      officialUrl: "https://stake.lido.fi",
    }),
    dims: { credit: 90, security: 82, custody: 86, liquidity: 68, sustainability: 88, transparency: 90 },
    expectedGrade: "A",
    rationale: "质押龙头、罚没损失均由运营商吸收，短板为退出排队与二级市场脱锚尾部风险。",
    yieldSource: "以太坊共识层与执行层质押奖励，Lido 收取奖励的 10% 作为协议费后分配。",
    lossScenarios: "验证者罚没风险（历史事件损失均由运营商/保证金吸收，未穿透持有人）；官方赎回需排队；极端行情下 stETH 二级市场价格可能低于 ETH 平价；运营商集中度风险（头部运营商承载九成以上质押量）。",
  },
  {
    product: onchain({
      id: "compound-v3-usdc-ethereum", platformId: "compound", name: "Compound v3 供给", asset: "USDC",
      type: "lending", chain: "Ethereum", officialUrl: "https://app.compound.finance",
    }),
    dims: { credit: 88, security: 84, custody: 88, liquidity: 72, sustainability: 82, transparency: 88 },
    expectedGrade: "S",
    rationale: "v3 单资产市场机制收敛、运行四年无事故、持续审计，短板为高利用率下赎回受约束。",
    yieldSource: "USDC 借款人支付的浮动借款利息；v3 每市场仅一个可借基础资产，抵押资产本身不生息。",
    lossScenarios: "智能合约风险；利用率约 90% 时赎回受可用流动性约束；USDC 发行方风险；v2 时期曾有预言机清算与奖励分发 bug 事件（v3 未发生用户本金损失）。",
  },
];
