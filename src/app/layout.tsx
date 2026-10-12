import "./globals.css";

export const metadata = {
  title: "DeFi 投资品聚合 — 高安全性产品，统一口径比较",
  description:
    "聚合头部交易所与头部协议的高安全性投资产品，给出标准化实际年化与风险评级。只做建议，不代客投资。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <a href="/" className="brand">🧭 DeFi 投资品聚合</a>
          <nav>
            <a href="/">产品列表</a>
            <a href="/activities">活动专区</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          本站只提供信息聚合与建议，不代客投资、不托管资金。所有收益数字均可溯源至数据源与抓取时间；历史收益不代表未来表现。
        </footer>
      </body>
    </html>
  );
}
