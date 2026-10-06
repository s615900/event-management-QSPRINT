import { adminRoute } from "@/server/admin/route";
import { albumScope } from "@/server/admin/album-scope";
import { writeAuditLog } from "@/server/admin/audit";
import { AlbumError, albumFieldReady, albumOverview, notifyAlbumOpen, saveAlbum } from "@/server/albums";
import { readBody } from "@/server/http";

function albumError(err: unknown) {
  if (err instanceof AlbumError) return Response.json({ error: err.message }, { status: err.status });
  throw err;
}

// GET ?event=賽事名稱：賽事清單＋選定賽事裡每位攝影師的相簿
export const GET = adminRoute(
  "讀取相簿失敗",
  async (req, session) => {
    const scope = albumScope(session);
    if ("response" in scope) return scope.response;
    const overview = await albumOverview(req.nextUrl.searchParams.get("event"), scope.photographer);
    return Response.json({ ...overview, fieldReady: albumFieldReady(), mine: scope.photographer });
  },
  { allowStaff: true },
);

// PUT：新增／更新「賽事＋攝影師」的相簿（連結、開放），notify=true 時開放後用 LINE 通知選手
export const PUT = adminRoute(
  "儲存相簿失敗",
  async (req, session) => {
    const scope = albumScope(session);
    if ("response" in scope) return scope.response;
    const body = (await readBody(req)) as unknown as {
      eventName?: string;
      photographer?: string;
      albumUrl?: string;
      isOpen?: boolean;
      notify?: boolean;
    };
    if (scope.photographer && body.photographer !== scope.photographer) {
      return Response.json({ error: "只能管理自己的相簿" }, { status: 403 });
    }
    try {
      const { album, before, becameOpen } = await saveAlbum({
        eventName: body.eventName ?? "",
        photographer: body.photographer ?? "",
        albumUrl: body.albumUrl,
        isOpen: body.isOpen,
      });
      const target = `賽事相簿 - ${album.eventName} / ${album.photographer}`;
      if (!before) {
        await writeAuditLog(session, "新增", target, `新增相簿連結：${album.albumUrl || "（未填）"}（${album.isOpen ? "已開放" : "未開放"}）`);
      } else {
        if (before.albumUrl !== album.albumUrl) await writeAuditLog(session, "編輯", target, `相簿連結：「${before.albumUrl}」→「${album.albumUrl}」`);
        if (before.isOpen !== album.isOpen) {
          await writeAuditLog(session, "開關切換", target, `是否開放相簿：「${before.isOpen ? "Yes" : "No"}」→「${album.isOpen ? "Yes" : "No"}」`);
        }
      }
      let notified: number | null = null;
      let notifyError: string | null = null;
      if (body.notify && album.isOpen) {
        try {
          notified = await notifyAlbumOpen(album.eventName, album.photographer);
        } catch (err) {
          notifyError = (err as Error).message;
        }
      }
      return Response.json({ album, becameOpen, notified, notifyError });
    } catch (err) {
      return albumError(err);
    }
  },
  { allowStaff: true },
);
