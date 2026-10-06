import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { ALBUM_FIELD, ragicGetOne, ragicPost, RAGIC_YES, SHEET } from "@/server/ragic";

export const POST = adminRoute(
  "切換相簿開放狀態失敗",
  async (_req: NextRequest, session, ctx: RouteContext<"/admin/api/albums/[id]/toggle">) => {
    const { id } = await ctx.params;
    const rec = await ragicGetOne(SHEET.ALBUM, id);
    if (!rec) return Response.json({ error: "查無此相簿資料" }, { status: 404 });
    const currentlyOpen = rec["是否開放相簿"] === RAGIC_YES;
    const nextValue = currentlyOpen ? "No" : "Yes";
    await ragicPost(`${SHEET.ALBUM}/${id}`, { [ALBUM_FIELD.isOpen]: nextValue }, { strict: true });
    await writeAuditLog(
      session,
      "開關切換",
      `賽事相簿 - ${rec["賽事名稱"] || ""} / ${rec["學校名稱"] || ""}`,
      `是否開放相簿：「${currentlyOpen ? "Yes" : "No"}」→「${nextValue}」`,
    );
    return Response.json({ success: true, isOpen: nextValue === "Yes" });
  },
);
