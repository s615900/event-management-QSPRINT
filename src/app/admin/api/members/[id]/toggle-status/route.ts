import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { ACCOUNT_STATUS_ACTIVE, ACCOUNT_STATUS_INACTIVE, MEMBER_FIELD, ragicGetOne, ragicPost, SHEET } from "@/server/ragic";

// 帳號狀態為單選欄位，值固定是「啟用」或「停用」
export const POST = adminRoute(
  "切換選手帳號狀態失敗",
  async (_req: NextRequest, session, ctx: RouteContext<"/admin/api/members/[id]/toggle-status">) => {
    const { id } = await ctx.params;
    const rec = await ragicGetOne(SHEET.MEMBER, id);
    if (!rec) return Response.json({ error: "查無此選手資料" }, { status: 404 });
    const currentlyActive = rec["帳號狀態"] === ACCOUNT_STATUS_ACTIVE;
    const current = currentlyActive ? ACCOUNT_STATUS_ACTIVE : ACCOUNT_STATUS_INACTIVE;
    const nextValue = currentlyActive ? ACCOUNT_STATUS_INACTIVE : ACCOUNT_STATUS_ACTIVE;
    await ragicPost(`${SHEET.MEMBER}/${id}`, { [MEMBER_FIELD.accountStatus]: nextValue }, { strict: true });
    await writeAuditLog(session, "開關切換", `選手資料表 - ${rec["選手姓名"] || id}`, `帳號狀態：「${current}」→「${nextValue}」`);
    return Response.json({ success: true, accountStatus: nextValue });
  },
);
