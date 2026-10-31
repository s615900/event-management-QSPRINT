import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { normalize, ragicGetOne, ragicPost, RAGIC_YES, SHEET, SPONSOR_FIELD } from "@/server/ragic";
import { readBody } from "@/server/http";

type Ctx = RouteContext<"/admin/api/sponsors/[id]">;

// 勾選／取消「已回覆」（有回覆謝謝給這位贊助者）
export const PATCH = adminRoute("更新贊助回報失敗", async (req: NextRequest, _session, ctx: Ctx) => {
  const { id } = await ctx.params;
  const before = await ragicGetOne(SHEET.SPONSOR, id);
  if (!before) return Response.json({ error: "查無這筆贊助回報" }, { status: 404 });
  const body = (await readBody(req)) as Record<string, unknown>;
  const replied = body.replied === true || normalize(String(body.replied ?? "")) === "true";
  await ragicPost(`${SHEET.SPONSOR}/${id}`, { [SPONSOR_FIELD.replied]: replied ? RAGIC_YES : "No" }, { strict: true });
  return Response.json({ success: true });
});
