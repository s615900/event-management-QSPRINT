import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { albumScope } from "@/server/admin/album-scope";
import { writeAuditLog } from "@/server/admin/audit";
import { AlbumError, deleteAlbum } from "@/server/albums";

export const DELETE = adminRoute(
  "刪除相簿失敗",
  async (_req: NextRequest, session, ctx: RouteContext<"/admin/api/albums/[id]">) => {
    const scope = albumScope(session);
    if ("response" in scope) return scope.response;
    try {
      const album = await deleteAlbum((await ctx.params).id, scope.photographer);
      await writeAuditLog(session, "刪除", `賽事相簿 - ${album.eventName} / ${album.photographer}`, `刪除相簿連結：${album.albumUrl}`);
      return Response.json({ success: true });
    } catch (err) {
      if (err instanceof AlbumError) return Response.json({ error: err.message }, { status: err.status });
      throw err;
    }
  },
  { allowStaff: true },
);
