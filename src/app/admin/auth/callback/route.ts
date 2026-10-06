import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findActiveAdmin, googleEnv, OAUTH_STATE_COOKIE } from "@/server/admin/google";
import { ADMIN_SESSION_COOKIE, createSessionToken, SESSION_COOKIE_OPTS } from "@/server/admin/session";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
}

async function exchange(code: string): Promise<string> {
  try {
    const { clientId, clientSecret, redirectUri } = googleEnv();
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = (await tokenRes.json()) as { id_token?: string; error?: string };
    if (!tokenJson.id_token) {
      console.error("Google OAuth 換取 token 失敗", tokenJson.error);
      return "/admin/login?error=token";
    }

    // 用 Google tokeninfo 端點驗證 id_token（伺服器端驗證，不自行解 JWT）
    const infoRes = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(tokenJson.id_token)}`);
    const info = (await infoRes.json()) as GoogleTokenInfo;
    const emailVerified = info.email_verified === true || info.email_verified === "true";
    if (!infoRes.ok || info.aud !== clientId || !info.email || !emailVerified) {
      console.warn("Google id_token 驗證失敗");
      return "/admin/login?error=verify";
    }

    const admin = await findActiveAdmin(info.email);
    if (!admin) {
      console.info("登入嘗試被拒：不在管理員清單或未啟用", info.email);
      return "/admin/no-access";
    }

    const store = await cookies();
    const name = admin.name || info.name || info.email;
    const token =
      admin.role === "staff"
        ? createSessionToken(info.email, name, "staff", admin.staffId)
        : createSessionToken(info.email, name, "admin");
    store.set(ADMIN_SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
    return "/admin";
  } catch (err) {
    console.error("Google OAuth callback 處理失敗", err);
    return "/admin/login?error=server";
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete({ name: OAUTH_STATE_COOKIE, path: "/admin/auth" });

  if (!code || !state || !expectedState || state !== expectedState) {
    console.warn("Google OAuth callback state 不符或缺少 code");
    redirect("/admin/login?error=state");
  }
  // redirect() 會丟出特殊例外，所以放在 try/catch 外面
  redirect(await exchange(code));
}
