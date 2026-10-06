import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { fetchAll } from "@/server/admin/data";
import { normalize, ragicGetOne, SHEET } from "@/server/ragic";

// 選手的報名紀錄：依 LINE userId 反查報名表；沒有綁定 LINE 的選手回傳空陣列
export const GET = adminRoute(
  "查詢選手報名紀錄失敗",
  async (_req: NextRequest, _s, ctx: RouteContext<"/admin/api/members/[id]/registrations">) => {
    const { id } = await ctx.params;
    const member = await ragicGetOne(SHEET.MEMBER, id);
    if (!member) return Response.json({ error: "查無此選手資料" }, { status: 404 });
    const lineUserId = normalize(member["LINE userId"]);
    if (!lineUserId) return Response.json({ items: [] });

    const items = (await fetchAll(SHEET.REGISTRATION))
      .filter(({ rec }) => normalize(rec["LINE user ID"]) === lineUserId)
      .map(({ id: rid, rec }) => ({
        id: rid,
        eventName: rec["賽事名稱"] || "",
        date: rec["日期"] || "",
        itemCategory: rec["項目分類"] || "",
        eventItem: rec["比賽項目"] || "",
        group: normalize(rec["組別"]),
        school: rec["學校"] || "",
        bibNumber: rec["賽事號碼布"] || "",
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return Response.json({ items });
  },
);
