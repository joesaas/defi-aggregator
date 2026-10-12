import { NextResponse } from "next/server";
import { getProduct } from "@/lib/db";

/**
 * 官方跳转中转（架构 §9）：记录点击（成功指标统计）后 302 跳往官方页面。
 * 一期切片先以日志记录点击；展示「即将前往」中间提示页为下一步迭代。
 */
export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const product = getProduct(id);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
  console.log(`[go] click product=${id} -> ${product.officialUrl}`);
  return NextResponse.redirect(product.officialUrl, 302);
}
