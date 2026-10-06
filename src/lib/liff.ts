"use client";

import type { Liff } from "@line/liff";

// LIFF ID 可用環境變數覆寫，預設沿用原專案
export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2010405599-yknWwXWq";

// 本機略過 LINE：.env.local 設 NEXT_PUBLIC_LINE_TEST_MODE=1，且網址是 localhost 才會生效。
// 後端也要開 AUTH_TEST_MODE=1 才會接受測試憑證，正式環境兩邊都不會啟用。
const TEST_ID_TOKEN = "test-mode";
const TEST_PROFILE = { userId: "test-user-001", displayName: "測試選手", pictureUrl: undefined as string | undefined };

export function isLineTestMode(): boolean {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_LINE_TEST_MODE !== "1") return false;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

// 只實作頁面用到的 LIFF 功能
function fakeLiff(): Liff {
  return {
    isInClient: () => false,
    isLoggedIn: () => true,
    login: () => {},
    logout: () => {},
    getProfile: async () => TEST_PROFILE,
    getIDToken: () => TEST_ID_TOKEN,
    getOS: () => "web",
    getVersion: () => "本機測試（略過 LINE）",
    getLineVersion: () => null,
    openWindow: ({ url }: { url: string }) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  } as unknown as Liff;
}

let initPromise: Promise<Liff> | null = null;

// LIFF SDK 只能在瀏覽器載入；同一頁只初始化一次
export function getLiff(): Promise<Liff> {
  if (isLineTestMode()) return Promise.resolve(fakeLiff());
  if (!initPromise) {
    initPromise = import("@line/liff").then(async ({ default: liff }) => {
      await liff.init({ liffId: LIFF_ID });
      return liff;
    });
    initPromise.catch(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

// 後端一律以 Authorization header 的 LIFF ID Token 驗證身分（不信任 localStorage 裡的 lineUserId）
export async function getLineIdToken(): Promise<string> {
  try {
    const liff = await getLiff();
    return liff.getIDToken() || "";
  } catch {
    return "";
  }
}

export function authHeaders(idToken: string): Record<string, string> {
  return idToken ? { Authorization: "Bearer " + idToken } : {};
}

export function isPreviewMode(): boolean {
  return new URL(window.location.href).searchParams.get("preview") === "1";
}
