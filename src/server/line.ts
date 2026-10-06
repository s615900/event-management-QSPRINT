import "server-only";
import crypto from "node:crypto";
import { isAuthTestMode, TEST_LINE_ID_TOKEN, TEST_LINE_USER_ID } from "./test-mode";

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

interface LineVerifyResponse {
  sub?: string;
  aud?: string;
  error?: string;
  error_description?: string;
}

// 呼叫 LINE 官方端點驗證前端（LIFF）送來的 ID Token：簽章、發行者、對象（aud）、
// 過期時間皆由 LINE 伺服器驗證。回傳值（sub＝LINE userId）是唯一可信任的使用者身分——
// 前端自報的 lineUserId 只能當作「使用者聲稱的身分」，不可直接用來查詢或寫入他人資料。
async function verifyLineIdToken(idToken: string): Promise<string | null> {
  // 本機測試模式：略過 LINE，固定當成測試選手（正式環境 isAuthTestMode 一律為 false）
  if (isAuthTestMode() && idToken === TEST_LINE_ID_TOKEN) return TEST_LINE_USER_ID;
  const clientId = process.env.LIFF_CHANNEL_ID;
  if (!clientId) {
    console.error("LIFF_CHANNEL_ID 未設定，無法驗證 LINE ID Token");
    return null;
  }
  try {
    const res = await fetch(LINE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
      cache: "no-store",
    });
    const info = (await res.json()) as LineVerifyResponse;
    if (!res.ok || !info.sub || info.aud !== clientId) {
      console.warn("LINE ID Token 驗證失敗", { status: res.status, error: info.error, desc: info.error_description });
      return null;
    }
    return info.sub;
  } catch (err) {
    console.error("呼叫 LINE ID Token 驗證端點失敗", err);
    return null;
  }
}

/**
 * 保護所有「查詢/修改個人資料」的公開端點（選手資料、報名紀錄、相簿）。
 * 必須帶 Authorization: Bearer <LIFF ID Token>。成功回傳 { lineUserId }，失敗回傳 401 Response。
 */
export async function requireLineIdentity(
  req: Request,
): Promise<{ lineUserId: string } | { response: Response }> {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    return { response: Response.json({ error: "缺少 LINE 登入憑證，請從 LINE 重新開啟此頁面" }, { status: 401 }) };
  }
  const lineUserId = await verifyLineIdToken(idToken);
  if (!lineUserId) {
    return { response: Response.json({ error: "LINE 登入憑證驗證失敗，請從 LINE 重新開啟此頁面" }, { status: 401 }) };
  }
  return { lineUserId };
}

export interface RegistrationInfo {
  playerName: string;
  eventName: string;
  itemCategory: string;
  eventItem: string;
  date: string;
  time: string;
  bibNumber: string;
  photographer?: string;
}

// 報名成功後，透過 LINE Messaging API 推一則 Flex Message 給選手。失敗只記錄。preview/test 帳號不推。
export async function sendRegistrationNotification(lineUserId: string, info: RegistrationInfo): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("缺少 LINE_CHANNEL_ACCESS_TOKEN，跳過報名成功推播");
    return;
  }
  if (!lineUserId || lineUserId.startsWith("preview_") || lineUserId.startsWith("test-")) return;

  const row = (label: string, value: string, valueColor = "#333333") => ({
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: label, color: "#999999", size: "sm", flex: 2 },
      { type: "text", text: value || "—", wrap: true, color: valueColor, size: "sm", flex: 5 },
    ],
  });

  const flexMessage = {
    type: "flex",
    altText: "報名成功通知",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "賽事報名成功通知", weight: "bold", color: "#06C755", size: "md" },
          { type: "text", text: info.playerName || "—", weight: "bold", size: "xxl", margin: "md", wrap: true },
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              row("賽事", info.eventName),
              row("項目", `${info.itemCategory || ""} ${info.eventItem || ""}`.trim()),
              row("日期", `${info.date || "—"} ${info.time || ""}`.trim()),
              row("號碼", info.bibNumber, "#06C755"),
              ...(info.photographer ? [row("攝影師", info.photographer)] : []),
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "報名資料已成功送出，請留意賽事相關通知", size: "xs", color: "#aaaaaa", wrap: true, align: "center" },
        ],
      },
    },
  };

  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: lineUserId, messages: [flexMessage] }),
    });
    if (!res.ok) console.error("LINE 報名成功推播失敗", res.status, (await res.text()).slice(0, 300));
  } catch (err) {
    console.error("LINE 報名成功推播發送錯誤", err);
  }
}

const LINE_MULTICAST_URL = "https://api.line.me/v2/bot/message/multicast";

// 同一則訊息推給多位選手（相簿開放通知）。回傳實際送出的人數；測試／預覽帳號會略過
export async function multicastText(lineUserIds: string[], text: string): Promise<number> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("缺少 LINE_CHANNEL_ACCESS_TOKEN，無法發送 LINE 通知");
  const ids = [...new Set(lineUserIds)].filter((id) => id && !id.startsWith("preview_") && !id.startsWith("test-"));
  for (let i = 0; i < ids.length; i += 500) {
    const res = await fetch(LINE_MULTICAST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: ids.slice(i, i + 500), messages: [{ type: "text", text }] }),
    });
    if (!res.ok) throw new Error(`LINE 通知發送失敗（${res.status}）：${(await res.text()).slice(0, 200)}`);
  }
  return ids.length;
}

export async function replyText(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("缺少 LINE_CHANNEL_ACCESS_TOKEN，跳過 webhook 回覆");
    return;
  }
  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
    if (!res.ok) console.error("LINE webhook 回覆失敗", res.status, (await res.text()).slice(0, 300));
  } catch (err) {
    console.error("LINE webhook 回覆發送錯誤", err);
  }
}

// 驗證 X-Line-Signature：對「原始未解析」的 request body 做 HMAC-SHA256，Base64 後應與 header 相符
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
