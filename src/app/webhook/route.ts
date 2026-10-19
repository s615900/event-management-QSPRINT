import { after } from "next/server";
import { replyText, verifyLineSignature } from "@/server/line";
import { bindLineAccount } from "@/server/notify";
import { eachRecord, MEMBER_FIELD, ragicGet, ragicPost, SHEET } from "@/server/ragic";

// LINE Messaging API webhook（網址維持 /webhook，與 LINE Developers Console 設定一致）：
// 收到「解除綁定」文字訊息時，把選手資料表的帳號狀態改為停用；
// 收到「綁定 XXXXXXXX」時，把攝影師／管理員的 LINE userId 存起來（新選手、新報名通知用）。

interface LineWebhookEvent {
  type?: string;
  replyToken?: string;
  message?: { type?: string; text?: string };
  source?: { type?: string; userId?: string };
}

async function findMemberRecordId(lineUserId: string): Promise<string | null> {
  const data = await ragicGet(SHEET.MEMBER, `&where=1001178,eq,${encodeURIComponent(lineUserId)}`);
  let recordId: string | null = null;
  eachRecord(data, (r, id) => {
    if (!recordId && (r["LINE userId"] || "") === lineUserId) recordId = id;
  });
  return recordId;
}

async function handleUnbind(lineUserId: string, replyToken: string) {
  try {
    const recordId = await findMemberRecordId(lineUserId);
    if (!recordId) {
      await replyText(replyToken, "查無您的登錄資料，無需解除綁定。");
      return;
    }
    await ragicPost(`${SHEET.MEMBER}/${recordId}`, { [MEMBER_FIELD.accountStatus]: "停用" });
    await replyText(replyToken, "✅ 已解除綁定。如需重新使用，請重新開啟系統並完成登錄。");
  } catch (err) {
    console.error("處理解除綁定失敗", lineUserId, err);
  }
}

async function handleBind(code: string, lineUserId: string, replyToken: string) {
  try {
    const name = await bindLineAccount(code, lineUserId);
    await replyText(
      replyToken,
      name ? `✅ 綁定成功，${name} 之後會收到新選手加入與新報名的通知。` : "綁定碼不正確，請回後台確認後再傳一次。",
    );
  } catch (err) {
    console.error("處理綁定失敗", lineUserId, err);
    await replyText(replyToken, "綁定失敗，請稍後再試或通知管理員。");
  }
}

export async function POST(req: Request) {
  // 簽章必須對照未經解析的原始 body
  const rawBody = await req.text();
  if (!verifyLineSignature(rawBody, req.headers.get("x-line-signature"))) {
    console.warn("LINE webhook 簽章驗證失敗");
    return new Response(null, { status: 401 });
  }

  let events: LineWebhookEvent[] = [];
  try {
    const parsed = JSON.parse(rawBody) as { events?: unknown };
    if (Array.isArray(parsed.events)) events = parsed.events as LineWebhookEvent[];
  } catch {
    /* 格式不符就當作沒有事件 */
  }

  // 先回 200，避免 LINE 因處理時間過長而視為逾時並重送；實際處理在回應後執行
  after(async () => {
    for (const event of events) {
      const text = event.message?.text?.trim();
      const lineUserId = event.source?.userId;
      if (event.type === "message" && event.message?.type === "text" && text === "解除綁定" && lineUserId && event.replyToken) {
        await handleUnbind(lineUserId, event.replyToken);
      }
      const bind = text?.match(/^綁定\s+([0-9A-Za-z]{8})$/);
      if (event.type === "message" && event.message?.type === "text" && bind && lineUserId && event.replyToken) {
        await handleBind(bind[1], lineUserId, event.replyToken);
      }
    }
  });
  return new Response(null, { status: 200 });
}
