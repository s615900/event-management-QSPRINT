import "server-only";
import {
  eachRecord,
  EVENT_DAILY_SCHEDULE_SUBTABLE_KEY,
  ragicGet,
  ragicPostForm,
  SHEET,
  type RagicRecord,
} from "./ragic";
import { toIsoDate } from "./dates";

export type RagicRecordWithId = RagicRecord & { _recordId: string };

// 用 LINE userId 找出會員記錄（找不到回傳 null），含 Ragic 記錄 ID 以供後續更新。
// Ragic 的 where 篩選不可靠，查回來仍逐筆比對。
export async function findMemberRecord(lineUserId: string): Promise<RagicRecordWithId | null> {
  const data = await ragicGet(SHEET.MEMBER, `&where=1001178,eq,${encodeURIComponent(lineUserId)}`);
  let found: RagicRecordWithId | null = null;
  eachRecord(data, (r, id) => {
    if (found) return;
    if ((r["LINE userId"] || "") === lineUserId) found = { ...r, _recordId: id };
  });
  return found;
}

// 讀 IG 欄位：欄位名稱曾出現隱藏字元，依序嘗試「精確名稱」「欄位 ID」「去除隱藏字元後比對」
export function readMemberIg(r: RagicRecord): string {
  const HIDDEN = /[​‌‍﻿ 　]/g;
  const byNorm =
    Object.entries(r).find(([k]) => k.replace(HIDDEN, "").trim() === "IG 聯絡資訊")?.[1] ?? "";
  return r["IG 聯絡資訊"] || r["1001169"] || byNorm || "";
}

export interface DailyScheduleRow {
  date: string; // yyyy-MM-dd
  capacity: number;
}

// 賽事資訊總表「賽事每日場次」子表格。只看日期＋人數上限，不判斷報名開放時間區間。
export function parseDailySchedule(eventRecord: RagicRecord): DailyScheduleRow[] {
  const subtable = (eventRecord as unknown as Record<string, unknown>)[EVENT_DAILY_SCHEDULE_SUBTABLE_KEY] as
    | Record<string, RagicRecord>
    | undefined;
  if (!subtable || typeof subtable !== "object") return [];
  const rows: DailyScheduleRow[] = [];
  for (const key of Object.keys(subtable)) {
    const row = subtable[key];
    const date = toIsoDate(row["日期"] || "");
    if (!date) continue;
    rows.push({ date, capacity: parseInt(row["人數上限"] || "0", 10) || 0 });
  }
  return rows;
}

// 用賽事名稱找賽事資訊總表的記錄（找不到回傳 null）
export async function findEventRecordByName(eventName: string): Promise<RagicRecord | null> {
  const data = await ragicGet(SHEET.EVENT_LOOKUP, `&where=1001201,eq,${encodeURIComponent(eventName)}`);
  let found: RagicRecord | null = null;
  eachRecord(data, (r) => {
    if (found) return;
    if ((r["賽事名稱"] || "") === eventName) found = r;
  });
  return found;
}

// 即時查賽事報名表中「賽事名稱＝eventName 且 日期＝date」的筆數，用來跟人數上限比較
export async function countRegistrationsForDate(eventName: string, date: string): Promise<number> {
  const data = await ragicGet(SHEET.REGISTRATION, `&where=1001180,eq,${encodeURIComponent(eventName)}`);
  let count = 0;
  eachRecord(data, (r) => {
    if ((r["賽事名稱"] || "") === eventName && (r["日期"] || "") === date) count++;
  });
  return count;
}

// 賽事報名表的 Post-workflow 壞掉，寫入成功也不會回傳 ragicId。
// 這種情況下反查剛寫入的欄位組合，取出對應的記錄 ID，才能接著上傳大頭照。
export async function findJustCreatedRegistrationId(criteria: {
  lineUserId: string;
  eventName: string;
  date: string;
  time: string;
  bibNumber: string;
}): Promise<string | undefined> {
  const data = await ragicGet(SHEET.REGISTRATION, `&where=1001199,eq,${encodeURIComponent(criteria.lineUserId)}`);
  let bestId: string | undefined;
  eachRecord(data, (r, id) => {
    if ((r["LINE user ID"] || "") !== criteria.lineUserId) return;
    if ((r["賽事名稱"] || "") !== criteria.eventName) return;
    if ((r["日期"] || "") !== criteria.date) return;
    if ((r["時間"] || "") !== criteria.time) return;
    if ((r["賽事號碼布"] || "") !== criteria.bibNumber) return;
    // 同組合可能有多筆（重複報名），取記錄 ID 最大的（最新寫入的那筆）
    if (!bestId || Number(id) > Number(bestId)) bestId = id;
  });
  return bestId;
}

// LINE 大頭照網址有時效性，Ragic 圖片欄位需要實際檔案（multipart/form-data），
// 所以要先下載圖片再上傳。這是附加資訊，失敗只記 log、不影響主要資料寫入。
export async function uploadLinePictureToRagic(
  sheetPath: string,
  ragicId: string | number | undefined,
  fieldId: string,
  pictureUrl: string | undefined,
): Promise<void> {
  if (!ragicId || !pictureUrl) return;
  try {
    const imgRes = await fetch(pictureUrl);
    if (!imgRes.ok) throw new Error(`下載 LINE 大頭照失敗：HTTP ${imgRes.status}`);
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    const form = new FormData();
    form.set(fieldId, new Blob([buffer], { type: contentType }), "line-picture.jpg");
    await ragicPostForm(`${sheetPath}/${ragicId}`, form);
  } catch (err) {
    console.warn("LINE 大頭照上傳 Ragic 失敗，已略過（不影響主要資料寫入）", { sheetPath, ragicId, err });
  }
}
