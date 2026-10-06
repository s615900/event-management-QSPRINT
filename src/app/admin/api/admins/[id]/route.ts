import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { AdminListError, updateAdmin } from "@/server/admin/admins";

export const PATCH = adminRoute(
  "更新管理員失敗",
  async (req: NextRequest, session, ctx: RouteContext<"/admin/api/admins/[id]">) => {
    const { id } = await ctx.params;
    try {
      const { before, after } = await updateAdmin(id, await req.json().catch(() => ({})), session.email);
      const changes: string[] = [];
      if (before.name !== after.name) changes.push(`姓名：「${before.name}」→「${after.name}」`);
      if (before.email !== after.email) changes.push(`Email：「${before.email}」→「${after.email}」`);
      if (changes.length) await writeAuditLog(session, "編輯", `後台網站管理員清單 - ${before.name}`, changes.join("；"));
      if (before.active !== after.active) {
        await writeAuditLog(
          session,
          "開關切換",
          `後台網站管理員清單 - ${after.name}`,
          `狀態：「${before.active ? "啟用" : "停用"}」→「${after.active ? "啟用" : "停用"}」`,
        );
      }
      return Response.json(after);
    } catch (err) {
      if (err instanceof AdminListError) return Response.json({ error: err.message }, { status: err.status });
      throw err;
    }
  },
);
