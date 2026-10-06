import "server-only";
import { isFakeRagic } from "./test-mode";
import { fakeDelete, fakeGet, fakePost } from "./ragic-fake";

// Ragic REST 連線（原專案 qsprint.ts / album.ts / webhook.ts / admin/ragic.ts 各自重複一份，這裡合併成一份）。
// 認證：必須用 ?api&APIKey= 查詢參數（Basic Auth / ?api=KEY 都會被當成 guest 帳號讀不到資料）。
const RAGIC_BASE = "https://ap15.ragic.com/qsprint";

function ragicApiKey(): string {
  const key = process.env.RAGIC_API_KEY;
  if (!key) throw new Error("缺少 RAGIC_API_KEY 環境變數");
  return key;
}

// path 例如 "new-beta/3" 或 "new-test-parameters/4"（tab/表單編號），可再接記錄 ID："new-beta/2/15"
export function ragicUrl(path: string, extra = ""): string {
  return `${RAGIC_BASE}/${path}?api&APIKey=${encodeURIComponent(ragicApiKey())}${extra}`;
}

export type RagicRecord = Record<string, string>;

function parseJson(text: string, label = "Ragic 回傳格式錯誤"): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(label);
  }
}

export async function ragicGet(path: string, extra = ""): Promise<Record<string, unknown>> {
  if (isFakeRagic()) return fakeGet(path); // 本機測試：沒填金鑰時用假資料
  const res = await fetch(ragicUrl(path, extra), { cache: "no-store" });
  const json = parseJson(await res.text());
  if (json.status === "ERROR") {
    throw new Error(`Ragic 讀取失敗：${String(json.msg ?? "")}`);
  }
  return json;
}

// Ragic 會先寫入記錄、再跑 Post-workflow。某些工作表的 Post-workflow 壞掉
// （例如 loadAllLinkAndLoad），會回傳 status:ERROR / code:202，但記錄其實已存檔。
// 這種 workflow 錯誤要視為成功，否則使用者會看到「送出失敗」而重送造成重複記錄。
// 注意：欄位驗證失敗（例如必填沒填）也會回 code:202，但 status 是 "INVALID"、記錄「沒有」存檔，
// 不能當成功（原版只看 code 202，導致必填沒填時畫面顯示成功、Ragic 卻沒有資料）。
function isPostWorkflowError(result: Record<string, unknown>) {
  if (result.status === "INVALID") return false;
  const msg = String(result.msg ?? "");
  return /post-workflow/i.test(msg) || (result.status === "ERROR" && result.code === 202);
}

function assertWriteOk(result: Record<string, unknown>, label: string) {
  const msg = String(result.msg ?? "");
  if (result.status && result.status !== "SUCCESS" && !isPostWorkflowError(result)) {
    throw new Error(`${label}：${msg || String(result.status)}`);
  }
}

/**
 * 寫入 Ragic（用數字欄位 ID 當 key）。
 * strict：後台用。整體 status 為 SUCCESS 不代表每個欄位都寫入成功——Ragic 會先存檔、
 * 再把格式不符的個別欄位回報在 errors 陣列裡（稽核紀錄表的日期格式 bug 即此類），
 * strict 模式會把這種情況當成失敗。前台報名沿用原本的寬鬆行為。
 */
export async function ragicPost(
  path: string,
  body: Record<string, string>,
  { strict = false }: { strict?: boolean } = {},
): Promise<Record<string, unknown>> {
  if (isFakeRagic()) return fakePost(path, body);
  const res = await fetch(ragicUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result = parseJson(await res.text());
  assertWriteOk(result, "Ragic 寫入失敗");
  if (strict) {
    const errors = Array.isArray(result.errors) ? result.errors : [];
    if (errors.length > 0) {
      const detail = errors
        .map((e) =>
          e && typeof e === "object"
            ? String((e as Record<string, unknown>).msg ?? JSON.stringify(e))
            : String(e),
        )
        .join("；");
      throw new Error(`Ragic 寫入失敗（部分欄位被拒絕）：${detail}`);
    }
  }
  return result;
}

export async function ragicPostForm(path: string, form: FormData): Promise<void> {
  if (isFakeRagic()) return; // 假資料不存圖片
  const res = await fetch(ragicUrl(path), { method: "POST", body: form, cache: "no-store" });
  const result = parseJson(await res.text(), "Ragic 圖片上傳回傳格式錯誤");
  assertWriteOk(result, "Ragic 圖片上傳失敗");
}

export async function ragicDelete(path: string): Promise<void> {
  if (isFakeRagic()) return fakeDelete(path);
  const res = await fetch(ragicUrl(path), { method: "DELETE", cache: "no-store" });
  const result = parseJson(await res.text());
  if (result.status === "ERROR") {
    throw new Error(`Ragic 刪除失敗：${String(result.msg ?? "")}`);
  }
}

// 走訪 Ragic 回傳的記錄（top-level key 為記錄 ID，略過 _ 開頭的系統欄位）
export function eachRecord(
  data: Record<string, unknown>,
  fn: (rec: RagicRecord, id: string) => void,
): void {
  for (const key of Object.keys(data)) {
    if (key.startsWith("_")) continue;
    const rec = data[key];
    if (rec && typeof rec === "object") fn(rec as RagicRecord, key);
  }
}

// 讀取單筆記錄（GET path/id 回傳 { [id]: record }）
export async function ragicGetOne(path: string, id: string): Promise<RagicRecord | undefined> {
  const data = await ragicGet(`${path}/${id}`);
  return data[id] as RagicRecord | undefined;
}

// 去除零寬空白等隱藏字元後再 trim——Ragic 資料中已確認出現過帶零寬空白的欄位值
// （例如「組別」欄位曾出現 "​公開男"），直接比對/搜尋會誤判為不相符。
const HIDDEN_CHARS = /[​‌‍﻿　]/g;
export function normalize(s: string | undefined | null): string {
  return (s ?? "").replace(HIDDEN_CHARS, "").trim();
}

// ─── Sheet 路徑與 Field ID 常數（已與使用者逐一確認，勿憑欄位名稱猜測）──────

export const SHEET = {
  MEMBER: "new-beta/2", // 選手資料表
  REGISTRATION: "new-beta/3", // 賽事報名表
  EVENT_OPEN_LIST: "new-beta/4", // 前台賽事清單（302 轉到 new-test-parameters/3，沿用原前台讀法）
  SCHOOL: "new-beta/6", // 前台登錄頁學校清單
  ALBUM: `new-beta/${process.env.RAGIC_ALBUM_SHEET ?? "7"}`, // 賽事相簿連結
  ADMIN_LIST: "new-test-parameters/6", // 後台網站管理員清單（舊路徑 /4 會 302 轉到這裡；寫入不能經過轉址）
  EVENT_LOOKUP: "new-test-parameters/3", // 賽事資訊總表（賽事主檔）
  SCHOOL_LOOKUP: "new-test-parameters/2", // 國高中職學校清單——後台下拉選單來源
  AUDIT_LOG: "new-test-parameters/5", // 操作紀錄表
  PHOTOGRAPHER: "new-test-parameters/7", // 攝影師名單
  EVENT_ITEMS: "new-test-parameters/1", // 比賽項目表：報名頁「項目分類／比賽項目」選單來源
} as const;

// 選手資料表（new-beta/2）
export const MEMBER_FIELD = {
  playerNumber: "1001165", // 青春止秒選手編號，唯讀（Ragic 自動編號）
  playerName: "1001166",
  school: "1001167",
  group: "1001168",
  ig: "1001169",
  email: "1001170",
  picture: "1001175",
  phone: "1001176",
  lineName: "1001177",
  lineUserId: "1001178",
  accountStatus: "1001223",
  createdDate: "1001173",
  updatedDate: "1001200",
} as const;

// 賽事資訊總表（new-test-parameters/3）——只有賽事名稱／開始日期／結束日期／是否開放報名／建立日期
export const EVENT_FIELD = {
  eventName: "1001201",
  startDate: "1001202",
  endDate: "1001203",
  openForRegistration: "1001204", // 勾選，值 "Yes"/"No"
  createdDate: "1001205",
} as const;

// 賽事報名表（new-beta/3）
export const REGISTRATION_FIELD = {
  eventName: "1001180",
  date: "1001181",
  group: "1001182",
  time: "1001183",
  itemCategory: "1001184",
  eventItem: "1001185",
  school: "1001186",
  playerName: "1001187",
  ig: "1001188",
  lineName: "1001198",
  lineUserId: "1001199",
  email: "1001212",
  bibNumber: "1001216",
  picture: "1001222",
  photographer: "1001462" as string, // 選手挑的攝影師（存名稱，文字欄位）
} as const;

// 攝影師名單（new-test-parameters/7）——欄位 ID 取自 Ragic 表單結構
export const PHOTOGRAPHER_FIELD = {
  name: "1001454",
  role: "1001455", // 單選：攝影師／小編
  phone: "1001456",
  email: "1001457",
  status: "1001458", // 單選：在職／離職
  adminAccess: "1001459", // 勾選：Yes／No
  notes: "1001460",
  // 勾選：Yes／No，可在後台管理自己拍攝的相簿。空白＝Ragic 尚未新增此欄位
  albumAccess: "" as string,
} as const;

// 賽事相簿連結（new-beta/7）
export const ALBUM_FIELD = {
  eventName: "1001217", // 連結欄位，寫入格式為目標資料的「顯示值」（賽事名稱文字）
  albumUrl: "1001218",
  school: "1001220", // 舊版依學校分相簿用的欄位，現在不再寫入
  isOpen: "1001221", // 勾選欄位，值為 "Yes" / "No"
  // 相簿改成「賽事＋攝影師」一個資料夾（存攝影師名稱，文字欄位）。空白＝Ragic 尚未新增此欄位
  photographer: "" as string,
} as const;

// 後台網站管理員清單（new-test-parameters/6）——欄位 ID 取自 Ragic 表單結構
export const ADMIN_FIELD = {
  name: "1001229",
  email: "1001230",
  status: "1001231", // 「啟用」/「停用」
} as const;

// 操作紀錄表（new-test-parameters/5）
export const AUDIT_LOG_FIELD = {
  timestamp: "1001233", // 日期欄位，格式需為 yyyy/MM/dd HH:mm:ss（24 小時制）
  operatorName: "1001234",
  operatorEmail: "1001235",
  actionType: "1001236",
  targetDescription: "1001237",
  changeSummary: "1001238",
} as const;

// 「賽事每日場次」子表格容器 key（Field ID 1001318），各列欄位讀取時用顯示名稱
export const EVENT_DAILY_SCHEDULE_SUBTABLE_KEY = "_subtable_1001318";

export const ADMIN_STATUS_ACTIVE = "啟用";
export const ACCOUNT_STATUS_ACTIVE = "啟用";
export const ACCOUNT_STATUS_INACTIVE = "停用";
export const RAGIC_YES = "Yes";
