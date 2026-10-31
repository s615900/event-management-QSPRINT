import { adminRoute } from "@/server/admin/route";
import { fetchAll } from "@/server/admin/data";
import { normalize, RAGIC_YES, SHEET } from "@/server/ragic";

// 贊助清單：列出所有轉帳回報（新的在前），僅管理員
export const GET = adminRoute("讀取贊助清單失敗", async () => {
  const rows = await fetchAll(SHEET.SPONSOR);
  const items = rows.map(({ id, rec }) => ({
    id,
    name: normalize(rec["選手名稱"]),
    amount: Number(normalize(rec["金額"]).replace(/[^0-9.]/g, "")) || 0,
    last5: normalize(rec["帳號末五碼"]),
    transferDate: normalize(rec["轉帳日期"]),
    contact: normalize(rec["聯絡方式"]),
    note: normalize(rec["想說的話"]),
    replied: rec["已回覆"] === RAGIC_YES,
  }));
  return Response.json({ items });
});
