import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { diffFields, writeAuditLog } from "@/server/admin/audit";
import { fetchAlbumStatusByEventName, fetchSchoolsByEventName, toEventListItem } from "@/server/admin/data";
import { EVENT_FIELD, normalize, ragicGetOne, ragicPost, SHEET } from "@/server/ragic";
import { taipeiToday } from "@/server/dates";
import { readBody } from "@/server/http";

type Ctx = RouteContext<"/admin/api/events/[id]">;

export const GET = adminRoute("查詢賽事詳情失敗", async (_req: NextRequest, _s, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rec = await ragicGetOne(SHEET.EVENT_LOOKUP, id);
  if (!rec) return Response.json({ error: "查無此筆賽事資料" }, { status: 404 });
  const [schoolsByEvent, albumStatusByEvent] = await Promise.all([fetchSchoolsByEventName(), fetchAlbumStatusByEventName()]);
  return Response.json(toEventListItem(id, rec, schoolsByEvent, albumStatusByEvent, taipeiToday()));
});

const slashDate = (v: string) => v.replace(/-/g, "/");
const EDITABLE_FIELDS = [
  { key: "eventName", fieldId: EVENT_FIELD.eventName, label: "賽事名稱", ragicKey: "賽事名稱" },
  { key: "startDate", fieldId: EVENT_FIELD.startDate, label: "開始日期", ragicKey: "開始日期", transform: slashDate },
  { key: "endDate", fieldId: EVENT_FIELD.endDate, label: "結束日期", ragicKey: "結束日期", transform: slashDate },
];

export const PATCH = adminRoute("編輯賽事資料失敗", async (req: NextRequest, session, ctx: Ctx) => {
  const { id } = await ctx.params;
  const before = await ragicGetOne(SHEET.EVENT_LOOKUP, id);
  if (!before) return Response.json({ error: "查無此筆賽事資料" }, { status: 404 });

  const body = await readBody(req);
  const { writeBody, changes } = diffFields(before, body, EDITABLE_FIELDS, normalize);
  if ("openForRegistration" in body) {
    const newValue = body.openForRegistration === "Yes" ? "Yes" : "No";
    const oldValue = before["是否開放報名"] || "";
    if (newValue !== oldValue) {
      writeBody[EVENT_FIELD.openForRegistration] = newValue;
      changes.push(`是否開放報名：「${oldValue}」→「${newValue}」`);
    }
  }
  if (changes.length === 0) return Response.json({ success: true, changed: false });

  await ragicPost(`${SHEET.EVENT_LOOKUP}/${id}`, writeBody, { strict: true });
  await writeAuditLog(session, "編輯", `賽事資訊總表 - ${before["賽事名稱"] || id}`, changes.join("；"));
  return Response.json({ success: true, changed: true });
});
