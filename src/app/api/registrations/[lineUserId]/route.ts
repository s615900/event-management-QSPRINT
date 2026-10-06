import type { NextRequest } from "next/server";
import { requireLineIdentity } from "@/server/line";
import { eachRecord, ragicGet, SHEET } from "@/server/ragic";
import { serverError } from "@/server/http";

// 查詢個人報名記錄：需驗證身分且只能查自己的
export async function GET(req: NextRequest, ctx: RouteContext<"/api/registrations/[lineUserId]">) {
  const auth = await requireLineIdentity(req);
  if ("response" in auth) return auth.response;
  try {
    const { lineUserId } = await ctx.params;
    if (decodeURIComponent(lineUserId) !== auth.lineUserId) {
      return Response.json({ error: "無權限查詢此報名紀錄" }, { status: 403 });
    }
    const uid = auth.lineUserId;
    const data = await ragicGet(SHEET.REGISTRATION, `&where=1001199,eq,${encodeURIComponent(uid)}`);
    const records: Array<Record<string, string>> = [];
    eachRecord(data, (r, id) => {
      if ((r["LINE user ID"] || "") !== uid) return;
      records.push({
        id,
        eventName: r["賽事名稱"] || "",
        date: r["日期"] || "",
        time: r["時間"] || "",
        itemCategory: r["項目分類"] || "",
        eventItem: r["比賽項目"] || "",
        bibNumber: r["賽事號碼布"] || "",
        group: r["組別"] || "",
        school: r["學校"] || "",
        photographer: r["攝影師"] || "",
      });
    });
    records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return Response.json(records);
  } catch (err) {
    return serverError(err, "查詢報名記錄失敗");
  }
}
