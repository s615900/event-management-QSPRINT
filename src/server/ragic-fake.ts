import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { formatRagicTimestamp } from "./dates";

// 本機假 Ragic：只在測試模式且沒填 RAGIC_API_KEY 時使用（見 test-mode.ts）。
// 模擬 Ragic 的行為：寫入用數字欄位 ID、讀取回傳欄位顯示名稱，資料存在 data/ragic-fake.json。
// 欄位 ID 對照取自正式 Ragic 的表單結構。

type Rec = Record<string, unknown>;
type Sheet = Record<string, Rec>;
type Store = Record<string, Sheet>;

const FIELD_LABELS: Record<string, Record<string, string>> = {
  "new-beta/2": {
    "1001165": "青春止秒選手編號", "1001175": "上傳圖片（認臉時確認", "1001166": "選手姓名", "1001168": "組別",
    "1001169": "IG 聯絡資訊", "1001167": "學校", "1001176": "電話", "1001170": "E-MAIL", "1001177": "LINE 名稱",
    "1001178": "LINE userId", "1001223": "帳號狀態", "1001173": "資料建檔日", "1001200": "最後更新",
  },
  "new-beta/3": {
    "1001211": "報名編號", "1001199": "LINE user ID", "1001198": "LINE 名稱", "1001187": "選手姓名", "1001182": "組別",
    "1001186": "學校", "1001188": "IG 聯絡資訊", "1001212": "E-Mail", "1001180": "賽事名稱", "1001216": "賽事號碼布",
    "1001181": "日期", "1001183": "時間", "1001184": "項目分類", "1001185": "比賽項目", "1001222": "上傳圖片",
    "1001462": "攝影師",
  },
  "new-test-parameters/7": {
    "1001454": "名稱", "1001455": "職務", "1001456": "電話", "1001457": "Email", "1001458": "在職", "1001459": "後台權限", "1001460": "備註", "1001463": "相簿權限",
  },
  "new-beta/7": { "1001217": "賽事名稱", "1001220": "學校名稱", "1001218": "Google雲端連結", "1001221": "是否開放相簿", "1001464": "攝影師" },
  "new-test-parameters/2": { "1001213": "學校名稱", "1001214": "學籍" },
  "new-test-parameters/3": {
    "1001201": "賽事名稱", "1001202": "開始日期", "1001203": "結束日期", "1001204": "是否開放報名", "1001205": "建立日期",
  },
  "new-test-parameters/6": { "1001229": "姓名", "1001230": "Email", "1001231": "狀態" },
  "new-test-parameters/5": {
    "1001233": "時間戳記", "1001234": "操作者", "1001235": "Email", "1001236": "動作類型", "1001237": "目標資料描述", "1001238": "變更摘要",
  },
};

// 正式 Ragic 上舊路徑會轉址到新表單，這裡照做
const ALIASES: Record<string, string> = {
  "new-beta/4": "new-test-parameters/3",
  "new-beta/6": "new-test-parameters/2",
  "new-test-parameters/4": "new-test-parameters/6",
};

const STORE_PATH = path.join(process.cwd(), "data", "ragic-fake.json");

function seed(): Store {
  const today = formatRagicTimestamp(new Date()).slice(0, 10);
  const schools: Array<[string, string]> = [
    ["臺北市立建國高級中學", "高中"],
    ["臺北市立第一女子高級中學", "高中"],
    ["國立臺灣師範大學附屬高級中學", "高中"],
    ["國立臺灣師範大學", "大學"],
    ["國立臺灣體育運動大學", "大學"],
  ];
  return {
    "new-test-parameters/3": {
      "1": { 賽事名稱: "115年10/24-26 全國中等學校田徑錦標賽（測試）", 開始日期: "2026/10/24", 結束日期: "2026/10/26", 是否開放報名: "Yes", 建立日期: today },
      "2": { 賽事名稱: "115年11/7-8 臺北市秋季田徑賽（測試）", 開始日期: "2026/11/07", 結束日期: "2026/11/08", 是否開放報名: "Yes", 建立日期: today },
    },
    "new-test-parameters/2": Object.fromEntries(schools.map(([name, type], i) => [String(i + 1), { 學校名稱: name, 學籍: type }])),
    "new-beta/2": {},
    "new-beta/3": {},
    "new-beta/7": {},
    "new-test-parameters/5": {},
    "new-test-parameters/6": { "1": { 姓名: "本機測試", Email: "local-test@example.com", 狀態: "啟用" } },
    "new-test-parameters/1": {
      "1": { 項目分類: "徑賽", 項目名稱: "100公尺", 是否啟用: "✔" },
      "2": { 項目分類: "徑賽", 項目名稱: "400公尺", 是否啟用: "✔" },
      "3": { 項目分類: "跳部", 項目名稱: "跳遠", 是否啟用: "✔" },
      "4": { 項目分類: "擲部", 項目名稱: "標槍", 是否啟用: "✔" },
    },
    "new-test-parameters/7": { "1": { 名稱: "陳攝影師（測試）", 職務: "攝影師", 電話: "", Email: "", 在職: "在職", 後台權限: "No", 備註: "本機測試用" } },
  };
}

let cache: Store | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as Store;
  } catch {
    cache = seed();
    await persist();
  }
  return cache;
}

async function persist() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function locate(p: string): { sheet: string; id?: string } {
  const parts = p.split("/");
  const sheet = parts.slice(0, 2).join("/");
  return { sheet: ALIASES[sheet] ?? sheet, id: parts[2] };
}

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function fakeGet(p: string): Promise<Record<string, unknown>> {
  const store = await load();
  const { sheet, id } = locate(p);
  const rows = store[sheet] ?? {};
  // 回傳複本，避免呼叫端改到假資料庫
  const copy = JSON.parse(JSON.stringify(rows)) as Sheet;
  return id ? (copy[id] ? { [id]: copy[id] } : {}) : copy;
}

export function fakePost(p: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  return serialize(async () => {
    const store = await load();
    const { sheet, id } = locate(p);
    const labels = FIELD_LABELS[sheet] ?? {};
    const rows = (store[sheet] ??= {});
    const now = formatRagicTimestamp(new Date());
    let recordId = id;
    if (!recordId) {
      recordId = String(Math.max(0, ...Object.keys(rows).map(Number)) + 1);
      rows[recordId] = {};
      // 模擬 Ragic 自動產生的欄位
      if (sheet === "new-beta/2") {
        rows[recordId]["青春止秒選手編號"] = `QS${recordId.padStart(4, "0")}`;
        rows[recordId]["資料建檔日"] = now.slice(0, 10);
      }
      if (sheet === "new-beta/3") {
        rows[recordId]["報名編號"] = `R${recordId.padStart(5, "0")}`;
        rows[recordId]["報名時間"] = now;
      }
    }
    const rec = rows[recordId];
    if (!rec) return { status: "ERROR", msg: "查無此筆記錄" };
    for (const [fieldId, value] of Object.entries(body)) rec[labels[fieldId] ?? fieldId] = value;
    if (sheet === "new-beta/2") rec["最後更新"] = now;
    await persist();
    return { status: "SUCCESS", ragicId: Number(recordId) };
  });
}

export function fakeDelete(p: string): Promise<void> {
  return serialize(async () => {
    const store = await load();
    const { sheet, id } = locate(p);
    if (id && store[sheet]) delete store[sheet][id];
    await persist();
  });
}
