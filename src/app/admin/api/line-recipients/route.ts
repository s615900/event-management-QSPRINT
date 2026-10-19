import { adminRoute } from "@/server/admin/route";
import { listRecipients } from "@/server/notify";
import { ADMIN_FIELD, PHOTOGRAPHER_FIELD } from "@/server/ragic";

// LINE 通知收件人：管理員＋人員名單，附綁定狀態與綁定碼（只有管理員看得到）
export const GET = adminRoute("讀取 LINE 通知名單失敗", async () => {
  const items = (await listRecipients())
    .filter((r) => r.active)
    .map(({ kind, id, name, lineUserId, code }) => ({ kind, id, name, bound: Boolean(lineUserId), code }));
  return Response.json({ items, fieldsReady: Boolean(ADMIN_FIELD.lineUserId && PHOTOGRAPHER_FIELD.lineUserId) });
});
