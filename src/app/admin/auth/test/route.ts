import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  isAuthTestMode,
  SESSION_COOKIE_OPTS,
} from "@/server/admin/session";
import { findStaffAdminById } from "@/server/photographers";

// 本機測試登入：不經過 Google，直接發登入 cookie。正式環境一律 404。
// /admin/auth/test → 管理員；/admin/auth/test?staff=<id> → 以該攝影師的身分（需在職且有後台權限）
export async function GET(req: NextRequest) {
  if (!isAuthTestMode()) return new Response("Not Found", { status: 404 });
  const staffId = Number(req.nextUrl.searchParams.get("staff")) || 0;
  let token: string;
  if (staffId) {
    const staff = await findStaffAdminById(staffId);
    if (!staff) return new Response("這位攝影師沒有後台權限或已停用", { status: 400 });
    token = createSessionToken(staff.email, staff.name, "staff", staff.id);
  } else {
    token = createSessionToken("local-test@example.com", "本機測試", "admin");
  }
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
  redirect("/admin");
}
