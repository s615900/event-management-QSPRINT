import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "田徑賽事拍攝登記系統",
  description: "QSPRINT 田徑賽事拍攝登記：LINE 會員登錄、賽事報名、拍攝紀錄與相簿。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
