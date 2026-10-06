import "server-only";
import { ADMIN_STATUS_ACTIVE, eachRecord, normalize, ragicGet, SHEET } from "../ragic";
import { findStaffAdmin } from "../photographers";

export const OAUTH_STATE_COOKIE = "admin_oauth_state";

export function googleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("缺少 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI 環境變數");
  }
  return { clientId, clientSecret, redirectUri };
}

// 比對 email 是否存在於「後台網站管理員清單」且狀態為啟用。
// Ragic GET 回傳的 key 是欄位顯示名稱（"Email"/"狀態"/"姓名"），不是數字 Field ID。
export type LoginIdentity = { name: string; role: "admin" } | { name: string; role: "staff"; staffId: number };

export async function findActiveAdmin(email: string): Promise<LoginIdentity | null> {
  const data = await ragicGet(SHEET.ADMIN_LIST);
  let found: LoginIdentity | null = null;
  const target = normalize(email).toLowerCase();
  eachRecord(data, (r) => {
    if (found) return;
    if (normalize(r["Email"]).toLowerCase() !== target) return;
    if (normalize(r["狀態"]) !== ADMIN_STATUS_ACTIVE) return;
    found = { name: normalize(r["姓名"]) || email, role: "admin" };
  });
  if (found) return found;
  // 管理員清單沒有 → 再看是不是有勾「後台權限」的在職攝影師（只能看儀表板和自己的行程）
  const staff = await findStaffAdmin(email);
  return staff ? { name: staff.name, role: "staff", staffId: staff.id } : null;
}
