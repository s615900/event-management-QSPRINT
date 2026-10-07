import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { findStaffAdminById } from "../photographers";

// 無狀態簽章 cookie session（HMAC via SESSION_SECRET，7 天到期），格式同原專案，舊 cookie 仍可用
export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// role：admin＝管理員（全部功能）；staff＝有後台權限的攝影師（只能看儀表板和自己的拍攝行程）
// 舊版 cookie 沒有 role，視為管理員
export type AdminRole = "admin" | "staff";

export interface AdminSession {
  email: string;
  name: string;
  role: AdminRole;
  staffId?: number;
  albumAccess?: boolean; // 攝影師帳號：可管理自己拍攝的相簿（每次從攝影師名單重新讀取）
  schoolAccess?: boolean; // 攝影師帳號：可管理學校名單（每次從攝影師名單重新讀取）
}

interface SessionPayload extends AdminSession {
  exp: number; // epoch ms
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("缺少 SESSION_SECRET 環境變數");
  return secret;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

export function createSessionToken(email: string, name: string, role: AdminRole = "admin", staffId?: number): string {
  const payload: SessionPayload = { email, name, role, staffId, exp: Date.now() + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  let expected: string;
  try {
    expected = sign(data);
  } catch {
    return null;
  }
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() || !payload.email) return null;
    const role: AdminRole = payload.role === "staff" ? "staff" : "admin";
    const staffId = role === "staff" && typeof payload.staffId === "number" ? payload.staffId : undefined;
    return { email: payload.email, name: payload.name, role, staffId };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  // 正式環境走 HTTPS；本機 dev 是 HTTP，secure cookie 在那種情況下瀏覽器不會存
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SESSION_TTL_MS / 1000,
  path: "/admin",
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const session = verifySessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (session?.role === "staff") {
    // 攝影師帳號每次都重新確認：被停用或拿掉後台權限就立刻失效（不用等 cookie 過期）
    const staff = session.staffId !== undefined ? await findStaffAdminById(session.staffId) : null;
    if (!staff || staff.email !== session.email.trim().toLowerCase()) return null;
    return { ...session, name: staff.name, albumAccess: staff.albumAccess, schoolAccess: staff.schoolAccess };
  }
  return session;
}

// 後台 API 用：未登入回 401；攝影師帳號呼叫管理員專用 API 回 403
export async function requireAdminApi(
  { allowStaff = false }: { allowStaff?: boolean } = {},
): Promise<{ session: AdminSession } | { response: Response }> {
  const session = await getAdminSession();
  if (!session) return { response: Response.json({ error: "未登入或登入已過期" }, { status: 401 }) };
  if (session.role === "staff" && !allowStaff) {
    return { response: Response.json({ error: "攝影師帳號沒有這項權限" }, { status: 403 }) };
  }
  return { session };
}

// 本機測試登入（略過 Google）：只有 .env.local 設 AUTH_TEST_MODE=1 且不是正式環境才開放
export { isAuthTestMode } from "../test-mode";
