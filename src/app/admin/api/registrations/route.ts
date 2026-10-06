import { adminRoute, pageParams } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { fetchAll, toRegistrationListItem, type Row } from "@/server/admin/data";
import { normalize, ragicPost, REGISTRATION_FIELD, SHEET, type RagicRecord } from "@/server/ragic";
import { readBody } from "@/server/http";

// 排序可選欄位：賽事名稱、學校名稱、賽事時間（日期+時間合併比較）
const SORT_KEY_PICKER: Record<string, (rec: RagicRecord) => string> = {
  eventName: (rec) => normalize(rec["賽事名稱"]),
  school: (rec) => normalize(rec["學校"]),
  datetime: (rec) => `${normalize(rec["日期"])} ${normalize(rec["時間"])}`,
};

function sortRows(rows: Row[], sortKey: string, order: string): Row[] {
  const pick = SORT_KEY_PICKER[sortKey];
  // 未指定排序欄位 → 依 Ragic 記錄 ID（建檔順序）排序，升冪/降冪箭頭仍要生效
  const sorted = [...rows].sort((a, b) =>
    pick ? pick(a.rec).localeCompare(pick(b.rec), "zh-TW") : Number(a.id) - Number(b.id),
  );
  return order === "asc" ? sorted : sorted.reverse();
}

export const GET = adminRoute("查詢賽事報名表失敗", async (req) => {
  const sp = req.nextUrl.searchParams;
  const q = normalize(sp.get("q")).toLowerCase();
  const event = normalize(sp.get("event"));
  // 日期 YYYY-MM-DD、時間 HH:MM，字串比較即為時間先後
  const dateFrom = normalize(sp.get("dateFrom"));
  const dateTo = normalize(sp.get("dateTo"));
  const timeFrom = normalize(sp.get("timeFrom"));
  const timeTo = normalize(sp.get("timeTo"));
  const { limit, offset } = pageParams(req);
  const sortKey = sp.get("sort") ?? "";
  const sortOrder = sp.get("order") === "asc" ? "asc" : "desc";

  const filtered = (await fetchAll(SHEET.REGISTRATION)).filter(({ rec }) => {
    if (event && normalize(rec["賽事名稱"]) !== event) return false;
    const date = normalize(rec["日期"]);
    if (dateFrom && (!date || date < dateFrom)) return false;
    if (dateTo && (!date || date > dateTo)) return false;
    const time = normalize(rec["時間"]);
    if (timeFrom && (!time || time < timeFrom)) return false;
    if (timeTo && (!time || time > timeTo)) return false;
    if (q && !normalize(`${rec["學校"] || ""} ${rec["選手姓名"] || ""}`).toLowerCase().includes(q)) return false;
    return true;
  });
  const page = sortRows(filtered, sortKey, sortOrder).slice(offset, offset + limit);
  return Response.json({
    items: page.map(({ id, rec }) => ({ ...toRegistrationListItem(rec, id), photographer: rec["攝影師"] || "" })),
    total: filtered.length,
    hasMore: offset + page.length < filtered.length,
  });
});

const CREATE_FIELDS = [
  { key: "eventName", fieldId: REGISTRATION_FIELD.eventName, label: "賽事名稱", required: true },
  { key: "date", fieldId: REGISTRATION_FIELD.date, label: "日期", required: true },
  { key: "time", fieldId: REGISTRATION_FIELD.time, label: "時間", required: true },
  { key: "group", fieldId: REGISTRATION_FIELD.group, label: "組別", required: true },
  { key: "school", fieldId: REGISTRATION_FIELD.school, label: "學校", required: true },
  { key: "playerName", fieldId: REGISTRATION_FIELD.playerName, label: "選手姓名", required: true },
  { key: "ig", fieldId: REGISTRATION_FIELD.ig, label: "IG 聯絡資訊", required: false },
  { key: "email", fieldId: REGISTRATION_FIELD.email, label: "E-Mail", required: false },
  { key: "bibNumber", fieldId: REGISTRATION_FIELD.bibNumber, label: "賽事號碼布", required: false },
  { key: "itemCategory", fieldId: REGISTRATION_FIELD.itemCategory, label: "項目分類", required: false },
  { key: "eventItem", fieldId: REGISTRATION_FIELD.eventItem, label: "比賽項目", required: false },
];

export const POST = adminRoute("新增報名資料失敗", async (req, session) => {
  const body = await readBody(req);
  const missing = CREATE_FIELDS.filter((f) => f.required && !normalize(body[f.key])).map((f) => f.label);
  if (missing.length > 0) return Response.json({ error: `請填寫：${missing.join("、")}` }, { status: 400 });

  const writeBody: Record<string, string> = {};
  for (const f of CREATE_FIELDS) {
    const value = String(body[f.key] ?? "");
    if (value) writeBody[f.fieldId] = value;
  }
  await ragicPost(SHEET.REGISTRATION, writeBody, { strict: true });
  await writeAuditLog(
    session,
    "新增",
    `賽事報名表 - ${body.playerName || ""}`,
    `新增報名：${body.eventName || ""} / ${body.school || ""} / ${body.playerName || ""}`,
  );
  return Response.json({ success: true });
});
