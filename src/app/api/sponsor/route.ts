import { after } from "next/server";
import { notifyStaffAndAdmins } from "@/server/notify";
import { isFakeRagic } from "@/server/test-mode";
import { normalize, ragicPost, SHEET, SPONSOR_FIELD, SPONSOR_FIELD_READY } from "@/server/ragic";
import { jsonError, readBody, serverError } from "@/server/http";

// 贊助頁的「轉帳回報」：寫入 Ragic 贊助回報表，後台「贊助清單」讀這張表
// 不需 LINE 登入（公開頁面）：用隱藏欄位＋同一 IP 每分鐘次數限制擋機器人
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) for (const [k, v] of hits) if (v.every((t) => now - t >= 60_000)) hits.delete(k);
  return list.length > 5;
}

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (tooMany(ip)) return jsonError("送出太頻繁，請稍後再試", 429);
    // Ragic 欄位 ID 還沒確認前，正式環境不寫入，避免資料寫到錯的欄位
    if (!SPONSOR_FIELD_READY && !isFakeRagic()) return jsonError("贊助回報尚未開通", 503);

    const body = await readBody(req);
    if (normalize(body.website)) return Response.json({ success: true }); // 機器人填了隱藏欄位：假裝成功、不寫入
    const name = normalize(body.name);
    const contact = normalize(body.contact);
    const amount = normalize(body.amount).replace(/[^0-9]/g, "");
    const last5 = normalize(body.last5).replace(/[^0-9]/g, "");
    if (!name || !contact || !amount) return jsonError("請填寫名字、金額和聯絡方式", 400);
    if (last5.length !== 5) return jsonError("帳號末五碼請填 5 位數字", 400);

    await ragicPost(
      SHEET.SPONSOR,
      {
        [SPONSOR_FIELD.name]: name,
        [SPONSOR_FIELD.amount]: amount,
        [SPONSOR_FIELD.last5]: last5,
        [SPONSOR_FIELD.transferDate]: normalize(body.date).replace(/-/g, "/"),
        [SPONSOR_FIELD.contact]: contact,
        [SPONSOR_FIELD.note]: normalize(body.note),
              },
      { strict: true },
    );

    // 回應送出後才推播，只通知已綁定 LINE 的管理員；失敗只記錄，不影響回報結果
    const note = normalize(body.note);
    after(() =>
      notifyStaffAndAdmins(
        [
          "☕ 收到新的贊助回報",
          `名稱：${name}`,
          `金額：NT$ ${Number(amount).toLocaleString()}`,
          `帳號末五碼：${last5}`,
          `聯絡方式：${contact}`,
          ...(note ? [`留言：${note}`] : []),
          "請到後台「贊助清單」對帳並回覆。",
        ].join("\n"),
        null,
      ),
    );
    return Response.json({ success: true });
  } catch (err) {
    return serverError(err, "送出贊助回報失敗");
  }
}
