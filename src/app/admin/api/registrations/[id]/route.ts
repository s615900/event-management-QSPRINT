import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { diffFields, writeAuditLog } from "@/server/admin/audit";
import { toRegistrationListItem } from "@/server/admin/data";
import { normalize, ragicDelete, ragicGetOne, ragicPost, REGISTRATION_FIELD, SHEET } from "@/server/ragic";
import { readBody } from "@/server/http";

type Ctx = RouteContext<"/admin/api/registrations/[id]">;
const NOT_FOUND = () => Response.json({ error: "查無此筆報名資料" }, { status: 404 });

export const GET = adminRoute("查詢報名詳情失敗", async (_req: NextRequest, _s, ctx: Ctx) => {
  const { id } = await ctx.params;
  const r = await ragicGetOne(SHEET.REGISTRATION, id);
  if (!r) return NOT_FOUND();
  return Response.json({
    ...toRegistrationListItem(r, id),
    ig: r["IG 聯絡資訊"] || "",
    email: r["E-Mail"] || "",
    lineName: r["LINE 名稱"] || "",
    lineUserId: r["LINE user ID"] || "",
    registrationNumber: r["報名編號"] || "",
    registeredAt: r["報名時間"] || "",
    photographer: r["攝影師"] || "",
  });
});

const EDITABLE_FIELDS = [
  { key: "eventName", fieldId: REGISTRATION_FIELD.eventName, label: "賽事名稱", ragicKey: "賽事名稱" },
  { key: "date", fieldId: REGISTRATION_FIELD.date, label: "日期", ragicKey: "日期" },
  { key: "time", fieldId: REGISTRATION_FIELD.time, label: "時間", ragicKey: "時間" },
  { key: "group", fieldId: REGISTRATION_FIELD.group, label: "組別", ragicKey: "組別" },
  { key: "school", fieldId: REGISTRATION_FIELD.school, label: "學校", ragicKey: "學校" },
  { key: "playerName", fieldId: REGISTRATION_FIELD.playerName, label: "選手姓名", ragicKey: "選手姓名" },
  { key: "ig", fieldId: REGISTRATION_FIELD.ig, label: "IG 聯絡資訊", ragicKey: "IG 聯絡資訊" },
  { key: "email", fieldId: REGISTRATION_FIELD.email, label: "E-Mail", ragicKey: "E-Mail" },
  { key: "bibNumber", fieldId: REGISTRATION_FIELD.bibNumber, label: "賽事號碼布", ragicKey: "賽事號碼布" },
  { key: "itemCategory", fieldId: REGISTRATION_FIELD.itemCategory, label: "項目分類", ragicKey: "項目分類" },
  { key: "eventItem", fieldId: REGISTRATION_FIELD.eventItem, label: "比賽項目", ragicKey: "比賽項目" },
  { key: "photographer", fieldId: REGISTRATION_FIELD.photographer, label: "攝影師", ragicKey: "攝影師" },
];

export const PATCH = adminRoute("編輯報名資料失敗", async (req: NextRequest, session, ctx: Ctx) => {
  const { id } = await ctx.params;
  const before = await ragicGetOne(SHEET.REGISTRATION, id);
  if (!before) return NOT_FOUND();
  const { writeBody, changes } = diffFields(before, await readBody(req), EDITABLE_FIELDS, normalize);
  if (changes.length === 0) return Response.json({ success: true, changed: false });
  await ragicPost(`${SHEET.REGISTRATION}/${id}`, writeBody, { strict: true });
  await writeAuditLog(session, "編輯", `賽事報名表 - ${before["選手姓名"] || id}`, changes.join("；"));
  return Response.json({ success: true, changed: true });
});

export const DELETE = adminRoute("刪除報名資料失敗", async (_req: NextRequest, session, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rec = await ragicGetOne(SHEET.REGISTRATION, id);
  if (!rec) return NOT_FOUND();
  await ragicDelete(`${SHEET.REGISTRATION}/${id}`);
  await writeAuditLog(session, "刪除", `賽事報名表 - ${rec["選手姓名"] || id}`, "刪除報名資料");
  return Response.json({ success: true });
});
