"use client";

import type { Liff } from "@line/liff";

// LIFF ID 可用環境變數覆寫，預設沿用原專案
export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2010405599-2w4tn9a2";

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
    getDecodedIDToken: () => ({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    openWindow: ({ url }: { url: string }) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  } as unknown as Liff;
}

let initPromise: Promise<Liff> | null = null;

// LINE 的 ID Token 約一小時過期，但 LIFF 會把舊的暫存在手機上繼續回傳；
// 送到後端驗證就會得到「IdToken expired」。發現快過期／已過期時先登出再重新登入拿新的。
const REFRESH_FLAG = "em_liff_token_refresh";

function tokenExpired(liff: Liff): boolean {
  const decoded = liff.getDecodedIDToken();
  // 提早一分鐘換，避免送到後端時剛好過期
  return !decoded?.exp || decoded.exp * 1000 < Date.now() + 60_000;
}

async function refreshIfExpired(liff: Liff): Promise<void> {
  if (!liff.isLoggedIn() || !tokenExpired(liff)) {
    sessionStorage.removeItem(REFRESH_FLAG);
    return;
  }
  // 同一個分頁只自動重試一次，避免 LINE 一直給過期憑證時無限重新整理
  if (sessionStorage.getItem(REFRESH_FLAG)) return;
  sessionStorage.setItem(REFRESH_FLAG, "1");
  liff.logout();
  if (liff.isInClient()) {
    // LINE App 內：登出後重新整理會自動重新登入（不能呼叫 liff.login()，會出現「系統發生問題」）
    window.location.reload();
  } else {
    liff.login({ redirectUri: window.location.href });
  }
  // 頁面即將跳轉，讓後續程式停在這裡
  await new Promise(() => {});
}

// LIFF SDK 只能在瀏覽器載入；同一頁只初始化一次
export function getLiff(): Promise<Liff> {
  if (isLineTestMode()) return Promise.resolve(fakeLiff());
  if (!initPromise) {
    initPromise = import("@line/liff").then(async ({ default: liff }) => {
      await liff.init({ liffId: LIFF_ID });
      await refreshIfExpired(liff);
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

export type MemberLookup = {
  found: boolean;
  member?: {
    playerName?: string;
    group?: string;
    school?: string;
    email?: string;
    phone?: string;
    ig?: string;
    lineName?: string;
    accountStatus?: string;
  };
};

// 查詢這個 LINE 帳號是否已登錄。後端拒絕（例如 LINE 憑證驗證失敗）時丟出錯誤，
// 呼叫端不能把它當成「沒註冊過」，否則會讓已登錄的選手又看到登錄表單。
export async function fetchMember(lineUserId: string, idToken: string): Promise<MemberLookup> {
  const res = await fetch(`/api/member/${encodeURIComponent(lineUserId)}`, { headers: authHeaders(idToken) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `查詢選手資料失敗（${res.status}）`);
  return data as MemberLookup;
}

export function isPreviewMode(): boolean {
  return new URL(window.location.href).searchParams.get("preview") === "1";
}
