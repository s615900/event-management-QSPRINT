import "server-only";

// 日期輔助函式。所有「今天」都以台北時區為準（伺服器可能跑在 UTC 容器裡，
// 直接用 new Date() 取本地日期會在台北時間午夜前後整整差一天）。

const TZ = "Asia/Taipei";

// 回傳台北時區「今天」的 YYYY-MM-DD（與報名表日期欄位存的格式一致，可直接字串比較）
export function taipeiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// 取「本週」（週一～週日）日期範圍，offsetWeeks 可取上一週(-1)／本週(0)／下一週(1)…
export function getWeekRange(offsetWeeks = 0): { start: string; end: string } {
  const today = taipeiToday();
  const dow = weekdayOf(today);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(today, mondayOffset + offsetWeeks * 7);
  return { start: monday, end: addDays(monday, 6) };
}

export function currentYearMonth(): string {
  return taipeiToday().slice(0, 7);
}

// 寬鬆解析日期字串開頭的 YYYY-MM-DD 或 YYYY/MM/DD（後面可能帶時間，一律忽略），失敗回傳 null
export function parseDateLoose(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  const pad = (n: string) => n.padStart(2, "0");
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
}

// "2026/09/12" -> "2026-09-12"（<input type="date"> 需要連字號格式）
export function toIsoDate(d: string): string {
  return d.trim().replace(/\//g, "-");
}

// 從賽事名稱解析可靠的日期區間（Ragic 的「結束日期」欄位常有誤，賽事名稱內嵌的區間才可靠）。
// 例： "115年9/12-16" -> 2026-09-12 ~ 2026-09-16；跨月 "115年9/30-10/2" -> 2026-09-30 ~ 2026-10-02
// 民國年 + 1911 = 西元年。
export function parseEventDateRange(name: string): { start: string; end: string } | null {
  const m = name.match(
    /(\d{2,3})\s*年\s*(\d{1,2})\/(\d{1,2})\s*[-~－〜]\s*(?:(\d{1,2})\/)?(\d{1,2})/,
  );
  if (!m) return null;
  const year = parseInt(m[1], 10) + 1911;
  const sMonth = parseInt(m[2], 10);
  const sDay = parseInt(m[3], 10);
  const eMonth = m[4] ? parseInt(m[4], 10) : sMonth;
  const eDay = parseInt(m[5], 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(sMonth)}-${pad(sDay)}`,
    end: `${year}-${pad(eMonth)}-${pad(eDay)}`,
  };
}

// 賽事狀態標籤（依日期遠近粗分報名中／籌備中／尚未開放／已結束），沿用原專案暫定規則
export function eventStatusLabel(referenceDate: string, today: string, endDate?: string | null): string {
  if (endDate && endDate < today) return "已結束";
  const diffDays = (Date.parse(referenceDate) - Date.parse(today)) / (1000 * 60 * 60 * 24);
  if (diffDays <= 3) return "報名中";
  if (diffDays <= 14) return "籌備中";
  return "尚未開放";
}

// Ragic 日期時間欄位格式：24 小時制、斜線分隔的 yyyy/MM/dd HH:mm:ss（台北時區）
export function formatRagicTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12:false 在 en-US locale 仍可能把午夜輸出成 "24"，Ragic 要 00-23
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}/${get("month")}/${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}
