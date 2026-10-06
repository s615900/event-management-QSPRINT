import { adminRoute } from "@/server/admin/route";
import { fetchAll } from "@/server/admin/data";
import { normalize, RAGIC_YES, SHEET } from "@/server/ragic";
import { getWeekRange, parseDateLoose, taipeiToday } from "@/server/dates";

interface RegisteredPlayer {
  playerName: string;
  time: string;
  itemCategory: string;
  eventItem: string;
  bibNumber: string;
  school: string;
}

// 本週賽事檔期總覽。offset：上一週 -1／本週 0／下一週 1（可連續往前/後翻）
export const GET = adminRoute("查詢本週賽事失敗", async (req) => {
  const offsetRaw = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;
  const week = getWeekRange(offset);

  const [registrations, albums] = await Promise.all([fetchAll(SHEET.REGISTRATION), fetchAll(SHEET.ALBUM)]);

  const albumOpenByEvent = new Map<string, boolean>();
  for (const { rec } of albums) {
    const eventName = normalize(rec["賽事名稱"]);
    if (eventName) albumOpenByEvent.set(eventName, albumOpenByEvent.get(eventName) || rec["是否開放相簿"] === RAGIC_YES);
  }

  // 依（賽事名稱＋日期）分組，列出當天每一位已報名選手
  const groups = new Map<string, { date: string; eventName: string; players: RegisteredPlayer[] }>();
  for (const { rec } of registrations) {
    const date = parseDateLoose(rec["日期"]);
    const eventName = normalize(rec["賽事名稱"]);
    if (!date || !eventName || date < week.start || date > week.end) continue;
    const key = `${eventName}__${date}`;
    if (!groups.has(key)) groups.set(key, { date, eventName, players: [] });
    groups.get(key)!.players.push({
      playerName: rec["選手姓名"] || "",
      time: rec["時間"] || "",
      itemCategory: rec["項目分類"] || "",
      eventItem: rec["比賽項目"] || "",
      bibNumber: rec["賽事號碼布"] || "",
      school: rec["學校"] || "",
    });
  }

  // 週一到週日 7 天的骨架，沒有賽事的日子維持空陣列
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${week.start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      weekday: d.getUTCDay(),
      events: [] as Array<{ eventName: string; albumOpen: boolean; players: RegisteredPlayer[] }>,
    };
  });
  for (const g of groups.values()) {
    days.find((d) => d.date === g.date)?.events.push({
      eventName: g.eventName,
      albumOpen: albumOpenByEvent.get(g.eventName) || false,
      players: g.players,
    });
  }
  days.forEach((day) => day.events.sort((a, b) => a.eventName.localeCompare(b.eventName, "zh-TW")));

  return Response.json({
    weekStart: week.start,
    weekEnd: week.end,
    offset,
    isCurrentWeek: week.start === getWeekRange(0).start,
    todayTaipei: taipeiToday(),
    days,
  });
});
