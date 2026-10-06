import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { albumOverview, notifyAlbumOpen, saveAlbum } from "@/server/albums";
import { readBody } from "@/server/http";

// 管理員：一次開放某場賽事所有「已貼連結但還沒開放」的相簿，可選擇同時通知選手
export const POST = adminRoute("全部開放失敗", async (req, session) => {
  const body = (await readBody(req)) as unknown as { eventName?: string; notify?: boolean };
  const eventName = body.eventName ?? "";
  const { rows, selected } = await albumOverview(eventName, null);
  if (selected !== eventName) return Response.json({ error: "查無此賽事" }, { status: 404 });

  let opened = 0;
  let notified = 0;
  const errors: string[] = [];
  for (const row of rows) {
    if (!row.album?.albumUrl || row.album.isOpen) continue;
    await saveAlbum({ eventName, photographer: row.photographer, isOpen: true });
    opened += 1;
    await writeAuditLog(session, "開關切換", `賽事相簿 - ${eventName} / ${row.photographer}`, "是否開放相簿：「No」→「Yes」（全部開放）");
    if (body.notify) {
      try {
        notified += await notifyAlbumOpen(eventName, row.photographer);
      } catch (err) {
        errors.push((err as Error).message);
      }
    }
  }
  return Response.json({ opened, notified, notifyError: errors[0] ?? null });
});
