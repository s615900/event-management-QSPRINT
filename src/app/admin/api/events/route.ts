import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { fetchAlbumStatusByEventName, fetchAll, fetchSchoolsByEventName, toEventListItem } from "@/server/admin/data";
import { EVENT_FIELD, normalize, ragicPost, SHEET } from "@/server/ragic";
import { taipeiToday } from "@/server/dates";
import { readBody } from "@/server/http";

// 賽事資訊總表（賽事主檔）列表
export const GET = adminRoute("查詢賽事資訊總表失敗", async (req) => {
  const sp = req.nextUrl.searchParams;
  const q = normalize(sp.get("q")).toLowerCase();
  const statusFilter = normalize(sp.get("status"));
  const today = taipeiToday();
  const [all, schoolsByEvent, albumStatusByEvent] = await Promise.all([
    fetchAll(SHEET.EVENT_LOOKUP),
    fetchSchoolsByEventName(),
    fetchAlbumStatusByEventName(),
  ]);
  let items = all.map(({ id, rec }) => toEventListItem(id, rec, schoolsByEvent, albumStatusByEvent, today));
  if (q) items = items.filter((it) => it.eventName.toLowerCase().includes(q));
  if (statusFilter) items = items.filter((it) => it.status === statusFilter);
  return Response.json({ items, total: items.length });
});

export const POST = adminRoute("新增賽事失敗", async (req, session) => {
  const body = await readBody(req);
  const eventName = normalize(body.eventName);
  const startDate = normalize(body.startDate).replace(/-/g, "/");
  const endDate = normalize(body.endDate).replace(/-/g, "/");
  if (!eventName || !startDate || !endDate) {
    return Response.json({ error: "請填寫賽事名稱、開始日期、結束日期" }, { status: 400 });
  }
  const openForRegistration = body.openForRegistration === "Yes" ? "Yes" : "No";
  await ragicPost(
    SHEET.EVENT_LOOKUP,
    {
      [EVENT_FIELD.eventName]: eventName,
      [EVENT_FIELD.startDate]: startDate,
      [EVENT_FIELD.endDate]: endDate,
      [EVENT_FIELD.openForRegistration]: openForRegistration,
    },
    { strict: true },
  );
  await writeAuditLog(session, "新增", `賽事資訊總表 - ${eventName}`, `新增賽事：${eventName}（${startDate} ~ ${endDate}）`);
  return Response.json({ success: true });
});
