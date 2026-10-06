"use client";

import { useEffect } from "react";

// 註冊後台 PWA 的 service worker（加入主畫面後離線也能開啟基本畫面）
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/admin/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
