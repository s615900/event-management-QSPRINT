import { adminRoute } from "@/server/admin/route";
import { eventDates, fetchAll } from "@/server/admin/data";
import { normalize, RAGIC_YES, SHEET } from "@/server/ragic";
import { currentYearMonth, eventStatusLabel, getWeekRange, parseDateLoose, taipeiToday } from "@/server/dates";

export const GET = adminRoute("查詢儀表板總覽失敗", async (_req, session) => {
  const [registrations, members, albums, masterRows] = await Promise.all([
    fetchAll(SHEET.REGISTRATION),
    fetchAll(SHEET.MEMBER),
    fetchAll(SHEET.ALBUM),
    fetchAll(SHEET.EVENT_LOOKUP),
  ]);
  const today = taipeiToday();
  const week = getWeekRange(0);
  const month = currentYearMonth();

  // 本週賽事數：本週日期內、不重複的賽事名稱
  const weeklyEventNames = new Set<string>();
  for (const { rec } of registrations) {
    const date = parseDateLoose(rec["日期"]);
    const eventName = normalize(rec["賽事名稱"]);
    if (date && eventName && date >= week.start && date <= week.end) weeklyEventNames.add(eventName);
  }

  // 本月新選手
  const newMembersThisMonth = members.filter(({ rec }) => parseDateLoose(rec["資料建檔日"])?.slice(0, 7) === month).length;

  // 待開放相簿數
  const albumsPendingCount = albums.filter(({ rec }) => rec["是否開放相簿"] !== RAGIC_YES).length;

  // 近期賽事：未來（含今天）日期，依（賽事名稱＋日期）分組，列出不重複學校
  const groups = new Map<string, { date: string; eventName: string; schools: Set<string> }>();
  for (const { rec } of registrations) {
    const date = parseDateLoose(rec["日期"]);
    const eventName = normalize(rec["賽事名稱"]);
    if (!date || !eventName || date < today) continue;
    const key = `${eventName}__${date}`;
    if (!groups.has(key)) groups.set(key, { date, eventName, schools: new Set() });
    const school = normalize(rec["學校"]);
    if (school) groups.get(key)!.schools.add(school);
  }
  const upcomingEvents = [...groups.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)
    .map((g) => ({
      date: g.date,
      eventName: g.eventName,
      school: [...g.schools].join("、") || "—",
      statusLabel: eventStatusLabel(g.date, today),
    }));

  // 近期賽事總覽：賽事主檔裡尚未結束的賽事
  const masterEvents = masterRows
    .map(({ rec }) => eventDates(rec))
    .filter((ev) => ev.eventName && (ev.endDate || ev.startDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 8);

  // 近期選手：依資料建檔日取最新 5 筆，透過 LINE userId 對照報名表找出最新一筆報名的賽事
  const latestByLineUserId = new Map<string, { date: string; eventName: string; id: string }>();
  for (const { id, rec } of registrations) {
    const lineUserId = normalize(rec["LINE user ID"]);
    if (!lineUserId) continue;
    const date = parseDateLoose(rec["日期"]) || "";
    const existing = latestByLineUserId.get(lineUserId);
    if (!existing || date > existing.date || (date === existing.date && Number(id) > Number(existing.id))) {
      latestByLineUserId.set(lineUserId, { date, eventName: normalize(rec["賽事名稱"]), id });
    }
  }
  const recentMembers = members
    .map(({ rec }) => ({ rec, created: parseDateLoose(rec["資料建檔日"]) || "" }))
    .filter((m) => m.created)
    .sort((a, b) => b.created.localeCompare(a.created))
    .slice(0, 5)
    .map(({ rec, created }) => {
      const lineUserId = normalize(rec["LINE userId"]);
      return {
        playerName: rec["選手姓名"] || "",
        phone: session.role === "staff" ? "" : rec["電話"] || "", // 攝影師帳號不顯示選手電話
        school: rec["學校"] || "",
        eventName: (lineUserId && latestByLineUserId.get(lineUserId)?.eventName) || "—",
        date: created,
      };
    });

  return Response.json({
    weeklyEventCount: weeklyEventNames.size,
    newMembersThisMonth,
    totalMembers: members.length,
    albumsPendingCount,
    upcomingEvents,
    recentMembers,
    masterEvents,
    viewer: { role: session.role, name: session.name },
  });
}, { allowStaff: true });
