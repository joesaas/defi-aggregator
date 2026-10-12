/**
 * 数据层（《技术架构设计》§4）。
 *
 * 本地开发用 Node 内置 node:sqlite 落库，表结构与架构文档的 PostgreSQL
 * 核心表一一对应（JSON 字段以 TEXT 存 JSON 串）； repository 函数即接口
 * 边界，切换 Postgres 时只换本文件实现，不动服务层与页面。
 *
 * 不变量：
 * - raw_snapshots 只追加，任何口径争议可回原文核对；
 * - yield_estimates 带 formula_version，公式升级全量重算、旧版本保留。
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  ContentBlock,
  Platform,
  Product,
  RiskAssessment,
  RiskDims,
  YieldEstimate,
  YieldPoint,
} from "./types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
  website TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, platform_id TEXT NOT NULL REFERENCES platforms(id),
  name TEXT NOT NULL, asset TEXT NOT NULL, type TEXT NOT NULL,
  chain TEXT, term_days INTEGER, redeem_eta TEXT NOT NULL,
  min_amount TEXT, access TEXT NOT NULL, kyc_required INTEGER NOT NULL DEFAULT 0,
  official_url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS raw_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL, product_ref TEXT, payload TEXT NOT NULL, fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_source_time ON raw_snapshots(source, fetched_at);
CREATE TABLE IF NOT EXISTS yield_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  nominal_apy REAL NOT NULL, base_apy REAL NOT NULL, subsidy_apy REAL NOT NULL DEFAULT 0,
  reward_apy REAL NOT NULL DEFAULT 0, reward_token TEXT,
  tvl_usd REAL, utilization REAL, source TEXT NOT NULL, ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_yield_product_ts ON yield_points(product_id, ts);
CREATE TABLE IF NOT EXISTS yield_estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  standardized_apy REAL NOT NULL, post_subsidy_apy REAL NOT NULL,
  discount_factor REAL NOT NULL, formula_version TEXT NOT NULL, computed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_est_product_ver ON yield_estimates(product_id, formula_version, computed_at);
CREATE TABLE IF NOT EXISTS risk_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  grade TEXT NOT NULL, dims TEXT NOT NULL, rationale TEXT NOT NULL,
  reviewer TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL, published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_risk_product ON risk_assessments(product_id, version);
CREATE TABLE IF NOT EXISTS activities (
  product_id TEXT PRIMARY KEY REFERENCES products(id),
  starts_at TEXT, ends_at TEXT, post_event_apy REAL
);
CREATE TABLE IF NOT EXISTS content_blocks (
  product_id TEXT NOT NULL REFERENCES products(id),
  kind TEXT NOT NULL, body TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (product_id, kind)
);
`;

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const dbPath =
    process.env.DB_PATH ?? path.join(process.cwd(), "data", "app.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

/* ---------------------------------- writes --------------------------------- */

export function upsertPlatform(p: Platform): void {
  getDb()
    .prepare(
      `INSERT INTO platforms (id, name, type, website, status) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type,
         website=excluded.website, status=excluded.status`,
    )
    .run(p.id, p.name, p.type, p.website, p.status);
}

export function upsertProduct(p: Product): void {
  getDb()
    .prepare(
      `INSERT INTO products (id, platform_id, name, asset, type, chain, term_days,
         redeem_eta, min_amount, access, kyc_required, official_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET platform_id=excluded.platform_id, name=excluded.name,
         asset=excluded.asset, type=excluded.type, chain=excluded.chain,
         term_days=excluded.term_days, redeem_eta=excluded.redeem_eta,
         min_amount=excluded.min_amount, access=excluded.access,
         kyc_required=excluded.kyc_required, official_url=excluded.official_url,
         status=excluded.status`,
    )
    .run(
      p.id, p.platformId, p.name, p.asset, p.type, p.chain, p.termDays,
      p.redeemEta, p.minAmount, p.access, p.kycRequired ? 1 : 0,
      p.officialUrl, p.status,
    );
}

/** 原始快照只追加（架构 §2 不变量），返回行 id 供日志引用 */
export function appendRawSnapshot(
  source: string,
  productRef: string | null,
  payload: unknown,
): number {
  const info = getDb()
    .prepare(
      `INSERT INTO raw_snapshots (source, product_ref, payload, fetched_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(source, productRef, JSON.stringify(payload), new Date().toISOString());
  return Number(info.lastInsertRowid);
}

export function insertYieldPoint(y: YieldPoint): void {
  getDb()
    .prepare(
      `INSERT INTO yield_points (product_id, nominal_apy, base_apy, subsidy_apy,
         reward_apy, reward_token, tvl_usd, utilization, source, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      y.productId, y.nominalApy, y.baseApy, y.subsidyApy, y.rewardApy,
      y.rewardToken, y.tvlUsd, y.utilization, y.source, y.ts,
    );
}

export function insertYieldEstimate(e: YieldEstimate): void {
  getDb()
    .prepare(
      `INSERT INTO yield_estimates (product_id, standardized_apy, post_subsidy_apy,
         discount_factor, formula_version, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      e.productId, e.standardizedApy, e.postSubsidyApy, e.discountFactor,
      e.formulaVersion, e.computedAt,
    );
}

export function insertRiskAssessment(r: RiskAssessment): void {
  getDb()
    .prepare(
      `INSERT INTO risk_assessments (product_id, grade, dims, rationale, reviewer,
         status, version, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      r.productId, r.grade, JSON.stringify(r.dims), r.rationale, r.reviewer,
      r.status, r.version, r.publishedAt,
    );
}

export function upsertContentBlock(b: ContentBlock): void {
  getDb()
    .prepare(
      `INSERT INTO content_blocks (product_id, kind, body, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(product_id, kind) DO UPDATE SET body=excluded.body,
         updated_by=excluded.updated_by, updated_at=excluded.updated_at`,
    )
    .run(b.productId, b.kind, b.body, b.updatedBy, b.updatedAt);
}

/* ---------------------------------- reads ---------------------------------- */

type Row = Record<string, unknown>;

function toProduct(r: Row): Product {
  return {
    id: String(r.id),
    platformId: String(r.platform_id),
    name: String(r.name),
    asset: String(r.asset),
    type: r.type as Product["type"],
    chain: (r.chain as string | null) ?? null,
    termDays: (r.term_days as number | null) ?? null,
    redeemEta: String(r.redeem_eta),
    minAmount: (r.min_amount as string | null) ?? null,
    access: r.access as Product["access"],
    kycRequired: Number(r.kyc_required) === 1,
    officialUrl: String(r.official_url),
    status: r.status as Product["status"],
  };
}

function toYieldPoint(r: Row): YieldPoint {
  return {
    productId: String(r.product_id),
    nominalApy: Number(r.nominal_apy),
    baseApy: Number(r.base_apy),
    subsidyApy: Number(r.subsidy_apy),
    rewardApy: Number(r.reward_apy),
    rewardToken: (r.reward_token as string | null) ?? null,
    tvlUsd: r.tvl_usd == null ? null : Number(r.tvl_usd),
    utilization: r.utilization == null ? null : Number(r.utilization),
    source: r.source as YieldPoint["source"],
    ts: String(r.ts),
  };
}

export function listPlatforms(): Platform[] {
  const rows = getDb().prepare(`SELECT * FROM platforms`).all() as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    type: r.type as Platform["type"],
    website: String(r.website),
    status: r.status as Platform["status"],
  }));
}

export function listProducts(): Product[] {
  const rows = getDb()
    .prepare(`SELECT * FROM products WHERE status = 'active' ORDER BY platform_id, id`)
    .all() as Row[];
  return rows.map(toProduct);
}

export function getProduct(id: string): Product | null {
  const r = getDb().prepare(`SELECT * FROM products WHERE id = ?`).get(id) as
    | Row
    | undefined;
  return r ? toProduct(r) : null;
}

export function latestYieldPoint(productId: string): YieldPoint | null {
  const r = getDb()
    .prepare(
      `SELECT * FROM yield_points WHERE product_id = ? ORDER BY ts DESC, id DESC LIMIT 1`,
    )
    .get(productId) as Row | undefined;
  return r ? toYieldPoint(r) : null;
}

export function yieldHistory(productId: string, days: number): YieldPoint[] {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT * FROM yield_points WHERE product_id = ? AND ts >= ? ORDER BY ts ASC`,
    )
    .all(productId, since) as Row[];
  return rows.map(toYieldPoint);
}

export function latestEstimate(
  productId: string,
  formulaVersion: string,
): YieldEstimate | null {
  const r = getDb()
    .prepare(
      `SELECT * FROM yield_estimates WHERE product_id = ? AND formula_version = ?
       ORDER BY computed_at DESC, id DESC LIMIT 1`,
    )
    .get(productId, formulaVersion) as Row | undefined;
  if (!r) return null;
  return {
    productId: String(r.product_id),
    standardizedApy: Number(r.standardized_apy),
    postSubsidyApy: Number(r.post_subsidy_apy),
    discountFactor: Number(r.discount_factor),
    formulaVersion: String(r.formula_version),
    computedAt: String(r.computed_at),
  };
}

export function latestPublishedRisk(productId: string): RiskAssessment | null {
  const r = getDb()
    .prepare(
      `SELECT * FROM risk_assessments WHERE product_id = ? AND status = 'published'
       ORDER BY version DESC LIMIT 1`,
    )
    .get(productId) as Row | undefined;
  if (!r) return null;
  return {
    productId: String(r.product_id),
    grade: r.grade as RiskAssessment["grade"],
    dims: JSON.parse(String(r.dims)) as RiskDims,
    rationale: String(r.rationale),
    reviewer: String(r.reviewer),
    status: "published",
    version: Number(r.version),
    publishedAt: (r.published_at as string | null) ?? null,
  };
}

export function listContentBlocks(productId: string): ContentBlock[] {
  const rows = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE product_id = ?`)
    .all(productId) as Row[];
  return rows.map((r) => ({
    productId: String(r.product_id),
    kind: r.kind as ContentBlock["kind"],
    body: String(r.body),
    updatedBy: String(r.updated_by),
    updatedAt: String(r.updated_at),
  }));
}
