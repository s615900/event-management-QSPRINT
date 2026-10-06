import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleEnv, OAUTH_STATE_COOKIE } from "@/server/admin/google";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET() {
  let env: ReturnType<typeof googleEnv>;
  try {
    env = googleEnv();
  } catch (err) {
    console.error("Google OAuth 環境變數未設定", err);
    return new Response("伺服器未設定 Google 登入，請聯絡管理員。", { status: 500 });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/admin/auth",
  });

  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
