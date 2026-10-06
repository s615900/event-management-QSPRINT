import type { NextConfig } from "next";

// 舊版靜態 HTML 網址 → 新網址（LINE LIFF 端點、選單連結、使用者書籤都可能還在用舊網址）
const legacyPages = ["register", "form", "history", "success", "album"];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: false },
      ...legacyPages.map((p) => ({ source: `/${p}.html`, destination: `/${p}`, permanent: false })),
      { source: "/admin/login.html", destination: "/admin/login", permanent: false },
      { source: "/admin/no-access.html", destination: "/admin/no-access", permanent: false },
      { source: "/admin/index.html", destination: "/admin", permanent: false },
      { source: "/admin/dashboard", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
