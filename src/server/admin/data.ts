import "server-only";
import { eachRecord, normalize, ragicGet, RAGIC_YES, SHEET, type RagicRecord } from "../ragic";
import { eventStatusLabel, parseEventDateRange } from "../dates";

export type Row = { id: string; rec: RagicRecord };

// Ragic 的 where 篩選不可靠，後台一律整表撈回後在伺服器端搜尋/分頁（後台資料量不大）
export async function fetchAll(path: string, newestFirst = true): Promise<Row[]> {
  const data = await ragicGet(path);
  const rows: Row[] = [];
  eachRecord(data, (rec, id) => rows.push({ id, rec }));
  rows.sort((a, b) => (newestFirst ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id)));
  return rows;
}

// 賽事日期：優先用賽事名稱內嵌的日期區間，主檔的開始/結束日期欄位僅作備援（結束日期欄位常有誤）
export function eventDates(rec: RagicRecord) {
  const eventName = normalize(rec["賽事名稱"]);
  const parsed = parseEventDateRange(eventName);
  return {
    eventName,
    startDate: parsed?.start || (rec["開始日期"] || "").replace(/\//g, "-"),
    endDate: parsed?.end || (rec["結束日期"] || "").replace(/\//g, "-"),
  };
}

// 賽事主檔沒有「地點/學校」欄位，用報名表依賽事名稱反查出現過的學校
export async function fetchSchoolsByEventName(): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  for (const { rec } of await fetchAll(SHEET.REGISTRATION)) {
    const eventName = normalize(rec["賽事名稱"]);
    const school = normalize(rec["學校"]);
    if (!eventName || !school) continue;
    if (!map.has(eventName)) map.set(eventName, new Set());
    map.get(eventName)!.add(school);
  }
  return map;
}

// 相簿狀態：同一賽事任一學校相簿開放即視為「開放」
export async function fetchAlbumStatusByEventName(): Promise<Map<string, "開放" | "未開放">> {
  const map = new Map<string, "開放" | "未開放">();
  for (const { rec } of await fetchAll(SHEET.ALBUM)) {
    const eventName = normalize(rec["賽事名稱"]);
    if (!eventName) continue;
    if (rec["是否開放相簿"] === RAGIC_YES) map.set(eventName, "開放");
    else if (!map.has(eventName)) map.set(eventName, "未開放");
  }
  return map;
}

export function toEventListItem(
  id: string,
  rec: RagicRecord,
  schoolsByEvent: Map<string, Set<string>>,
  albumStatusByEvent: Map<string, "開放" | "未開放">,
  today: string,
) {
  const { eventName, startDate, endDate } = eventDates(rec);
  const schools = schoolsByEvent.get(eventName);
  return {
    id,
    eventName,
    startDate,
    endDate,
    school: schools && schools.size > 0 ? [...schools].join("、") : "—",
    albumStatus: albumStatusByEvent.get(eventName) || "尚無相簿",
    status: eventStatusLabel(startDate || today, today, endDate || null),
    openForRegistration: rec["是否開放報名"] === RAGIC_YES,
  };
}

// 選手報名過的項目分類（依 LINE userId 反查報名表，去重）
export async function fetchItemTagsByLineUserId(): Promise<Map<string, string[]>> {
  const map = new Map<string, Set<string>>();
  for (const { rec } of await fetchAll(SHEET.REGISTRATION)) {
    const lineUserId = normalize(rec["LINE user ID"]);
    const itemCategory = normalize(rec["項目分類"]);
    if (!lineUserId || !itemCategory) continue;
    if (!map.has(lineUserId)) map.set(lineUserId, new Set());
    map.get(lineUserId)!.add(itemCategory);
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

export function toMemberListItem(r: RagicRecord, id: string, itemTags: Map<string, string[]>) {
  const lineUserId = normalize(r["LINE userId"]);
  return {
    id,
    playerNumber: r["青春止秒選手編號"] || "",
    playerName: r["選手姓名"] || "",
    school: r["學校"] || "",
    group: normalize(r["組別"]),
    phone: r["電話"] || "",
    ig: r["IG 聯絡資訊"] || "",
    email: r["E-MAIL"] || "",
    lineName: r["LINE 名稱"] || "",
    lineBound: !!lineUserId,
    accountStatus: r["帳號狀態"] || "",
    createdDate: r["資料建檔日"] || "",
    itemTags: (lineUserId && itemTags.get(lineUserId)) || [],
  };
}

export function toRegistrationListItem(r: RagicRecord, id: string) {
  return {
    id,
    eventName: r["賽事名稱"] || "",
    date: r["日期"] || "",
    time: r["時間"] || "",
    group: normalize(r["組別"]),
    school: r["學校"] || "",
    playerName: r["選手姓名"] || "",
    bibNumber: r["賽事號碼布"] || "",
    itemCategory: r["項目分類"] || "",
    eventItem: r["比賽項目"] || "",
  };
}

// 下拉選單：某張表某欄位的不重複值，依中文排序
export async function distinctColumn(path: string, column: string): Promise<string[]> {
  const names: string[] = [];
  for (const { rec } of await fetchAll(path)) {
    const v = normalize(rec[column]);
    if (v && !names.includes(v)) names.push(v);
  }
  return names.sort((a, b) => a.localeCompare(b, "zh-TW"));
}
