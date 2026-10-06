import { requireLineIdentity } from "@/server/line";
import { eachRecord, ragicGet, RAGIC_YES, SHEET } from "@/server/ragic";
import { serverError } from "@/server/http";

/**
 * GET /api/album/my：回傳此用戶可查看的賽事相簿清單。
 *   1. 選手資料表取得「目前最新」學校名稱（報名記錄存的是報名當下的名稱，管理員事後改名會對不上）
 *   2. 報名表取得此用戶報名過的賽事名稱（去重）
 *   3. 相簿資訊表以「賽事名稱＋學校」比對：開放 → 已公開＋連結；否則 → 準備中
 */
export async function GET(req: Request) {
  const auth = await requireLineIdentity(req);
  if ("response" in auth) return auth.response;
  try {
    const lineUserId = auth.lineUserId;
    const where = (fieldId: string) => `&where=${fieldId},eq,${encodeURIComponent(lineUserId)}`;

    const memberData = await ragicGet(SHEET.MEMBER, where("1001178"));
    let currentSchool = "";
    eachRecord(memberData, (r) => {
      if (!currentSchool && (r["LINE userId"] || "") === lineUserId) currentSchool = (r["學校"] || "").trim();
    });
    if (!currentSchool) return Response.json({ albums: [] });

    const regData = await ragicGet(SHEET.REGISTRATION, where("1001199"));
    const eventNames: string[] = [];
    eachRecord(regData, (r) => {
      if ((r["LINE user ID"] || "") !== lineUserId) return;
      const name = (r["賽事名稱"] || "").trim();
      if (name && !eventNames.includes(name)) eventNames.push(name);
    });
    if (eventNames.length === 0) return Response.json({ albums: [] });

    const albumData = await ragicGet(SHEET.ALBUM);
    const albumMap = new Map<string, { albumUrl: string; isOpen: boolean }>();
    eachRecord(albumData, (r) => {
      const eventId = (r["賽事名稱"] || "").trim();
      const school = (r["學校名稱"] || "").trim();
      if (!eventId || !school) return;
      albumMap.set(`${eventId}\x00${school}`, {
        albumUrl: r["Google雲端連結"] || "",
        isOpen: r["是否開放相簿"] === RAGIC_YES,
      });
    });

    const albums = eventNames.map((eventName) => {
      const album = albumMap.get(`${eventName}\x00${currentSchool}`);
      return {
        eventName,
        school: currentSchool,
        status: album?.isOpen ? "已公開" : "準備中",
        albumUrl: album?.isOpen ? album.albumUrl : "",
      };
    });
    return Response.json({ albums });
  } catch (err) {
    return serverError(err, "取得相簿清單失敗");
  }
}
