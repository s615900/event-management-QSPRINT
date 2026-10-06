import { requireLineIdentity } from "@/server/line";
import { eachRecord, normalize, ragicGet, SHEET } from "@/server/ragic";
import { loadAlbums } from "@/server/albums";
import { serverError } from "@/server/http";

/**
 * GET /api/album/my：回傳此用戶可查看的賽事相簿清單。
 * 相簿是「賽事＋攝影師」一個資料夾：用選手每筆報名的（賽事名稱、選的攝影師）去對照。
 * 開放 → 已公開＋連結；否則 → 準備中。沒選攝影師的舊報名也列出來，顯示準備中。
 */
export async function GET(req: Request) {
  const auth = await requireLineIdentity(req);
  if ("response" in auth) return auth.response;
  try {
    const lineUserId = auth.lineUserId;
    const regData = await ragicGet(SHEET.REGISTRATION, `&where=1001199,eq,${encodeURIComponent(lineUserId)}`);
    const pairs: Array<{ eventName: string; photographer: string; date: string }> = [];
    eachRecord(regData, (r) => {
      if ((r["LINE user ID"] || "") !== lineUserId) return;
      const eventName = normalize(r["賽事名稱"]);
      const photographer = normalize(r["攝影師"]);
      if (!eventName || pairs.some((p) => p.eventName === eventName && p.photographer === photographer)) return;
      pairs.push({ eventName, photographer, date: r["日期"] || "" });
    });
    if (pairs.length === 0) return Response.json({ albums: [] });

    const albums = await loadAlbums();
    const result = pairs
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map(({ eventName, photographer }) => {
        const album = albums.find((a) => a.eventName === eventName && a.photographer === photographer);
        const open = !!album?.isOpen && !!album.albumUrl;
        return {
          eventName,
          photographer,
          status: open ? "已公開" : "準備中",
          albumUrl: open ? album!.albumUrl : "",
        };
      });
    return Response.json({ albums: result });
  } catch (err) {
    return serverError(err, "取得相簿清單失敗");
  }
}
