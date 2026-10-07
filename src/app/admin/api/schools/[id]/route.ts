import type { NextRequest } from "next/server";
import { schoolRoute } from "@/server/admin/school-route";
import { writeAuditLog } from "@/server/admin/audit";
import { normalize, ragicDelete, ragicGetOne, ragicPost, SCHOOL_FIELD, SHEET } from "@/server/ragic";
import { readBody } from "@/server/http";

type Ctx = RouteContext<"/admin/api/schools/[id]">;

export const PATCH = schoolRoute("更新學校失敗", async (req: NextRequest, session, ctx: Ctx) => {
  const { id } = await ctx.params;
  const before = await ragicGetOne(SHEET.SCHOOL_LOOKUP, id);
  if (!before) return Response.json({ error: "查無這間學校" }, { status: 404 });
  const body = await readBody(req);
  const name = normalize(body.name);
  const type = normalize(body.type);
  if (!name) return Response.json({ error: "請填寫學校名稱" }, { status: 400 });
  await ragicPost(`${SHEET.SCHOOL_LOOKUP}/${id}`, { [SCHOOL_FIELD.name]: name, [SCHOOL_FIELD.type]: type }, { strict: true });
  const oldName = normalize(before["學校名稱"]);
  const oldType = normalize(before["學籍"]);
  const changes: string[] = [];
  if (oldName !== name) changes.push(`學校名稱：「${oldName}」→「${name}」`);
  if (oldType !== type) changes.push(`學籍：「${oldType}」→「${type}」`);
  if (changes.length) await writeAuditLog(session, "編輯", `學校名單 - ${oldName}`, changes.join("；"));
  return Response.json({ success: true });
});

export const DELETE = schoolRoute("刪除學校失敗", async (_req: NextRequest, session, ctx: Ctx) => {
  const { id } = await ctx.params;
  const before = await ragicGetOne(SHEET.SCHOOL_LOOKUP, id);
  if (!before) return Response.json({ error: "查無這間學校" }, { status: 404 });
  await ragicDelete(`${SHEET.SCHOOL_LOOKUP}/${id}`);
  await writeAuditLog(session, "刪除", `學校名單 - ${normalize(before["學校名稱"])}`, "刪除學校");
  return Response.json({ success: true });
});
