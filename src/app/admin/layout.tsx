import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "青春止秒 後台管理系統",
  manifest: "/admin/manifest.json",
  icons: { icon: "/admin/icons/icon-192.png", apple: "/admin/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "賽事後台", statusBarStyle: "black" },
  // Next 預設只輸出新版的 mobile-web-app-capable；iOS 的狀態列樣式認 apple- 開頭這個，兩個都要留
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0E3A5C",
  viewportFit: "cover",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
