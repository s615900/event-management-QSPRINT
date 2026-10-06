import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { diffFields, writeAuditLog } from "@/server/admin/audit";
import { fetchItemTagsByLineUserId, toMemberListItem } from "@/server/admin/data";
import { MEMBER_FIELD, normalize, ragicGetOne, ragicPost, SHEET } from "@/server/ragic";
import { readBody } from "@/server/http";

type Ctx = RouteContext<"/admin/api/members/[id]">;
const NOT_FOUND = () => Response.json({ error: "查無此選手資料" }, { status: 404 });

export const GET = adminRoute("查詢選手詳情失敗", async (_req: NextRequest, _s, ctx: Ctx) => {
  const { id } = await ctx.params;
  const r = await ragicGetOne(SHEET.MEMBER, id);
  if (!r) return NOT_FOUND();
  const lineUserId = r["LINE userId"] || "";
  return Response.json({
    ...toMemberListItem(r, id, await fetchItemTagsByLineUserId()),
    lineUserId,
    lineBound: !!lineUserId,
    updatedDate: r["最後更新"] || "",
  });
});

// 僅開放編輯：姓名、電話、IG 聯絡資訊、學校、組別——其餘欄位唯讀
const EDITABLE_FIELDS = [
  { key: "playerName", fieldId: MEMBER_FIELD.playerName, label: "姓名", ragicKey: "選手姓名" },
  { key: "phone", fieldId: MEMBER_FIELD.phone, label: "電話", ragicKey: "電話" },
  { key: "ig", fieldId: MEMBER_FIELD.ig, label: "IG 聯絡資訊", ragicKey: "IG 聯絡資訊" },
  { key: "school", fieldId: MEMBER_FIELD.school, label: "學校", ragicKey: "學校" },
  { key: "group", fieldId: MEMBER_FIELD.group, label: "組別", ragicKey: "組別" },
];

export const PATCH = adminRoute("編輯選手資料失敗", async (req: NextRequest, session, ctx: Ctx) => {
  const { id } = await ctx.params;
  const before = await ragicGetOne(SHEET.MEMBER, id);
  if (!before) return NOT_FOUND();
  const { writeBody, changes } = diffFields(before, await readBody(req), EDITABLE_FIELDS, normalize);
  if (changes.length === 0) return Response.json({ success: true, changed: false });
  await ragicPost(`${SHEET.MEMBER}/${id}`, writeBody, { strict: true });
  await writeAuditLog(session, "編輯", `選手資料表 - ${before["選手姓名"] || id}`, changes.join("；"));
  return Response.json({ success: true, changed: true });
});
