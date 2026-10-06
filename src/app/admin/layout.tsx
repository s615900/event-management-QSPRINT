import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "青春止秒 後台管理系統",
  manifest: "/admin/manifest.json",
  icons: { icon: "/admin/icons/icon-192.png", apple: "/admin/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "賽事後台", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0E3A5C",
  viewportFit: "cover",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
