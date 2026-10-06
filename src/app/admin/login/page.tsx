import "../auth-pages.css";
import { isAuthTestMode } from "@/server/admin/session";
import { listStaffAdmins } from "@/server/photographers";
import { RegisterServiceWorker } from "./RegisterServiceWorker";

const ERROR_MESSAGES: Record<string, string> = {
  state: "登入逾時或驗證失敗，請重新登入。",
  token: "無法向 Google 取得登入資訊，請重試。",
  verify: "登入驗證失敗，請重試。",
  server: "伺服器發生錯誤，請稍後再試。",
};

export const metadata = { title: "管理後台登入" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;
  const err = Array.isArray(error) ? error[0] : error;
  const testStaff = isAuthTestMode() ? (await listStaffAdmins()).filter((s) => s.active) : [];
  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- 小圖示，不需最佳化 */}
        <img className="auth-logo" src="/admin/icons/icon-192.png" alt="" />
        <h1>青春止秒官方網站後台管理系統</h1>
        <p>僅限授權管理員使用 Google 帳號登入</p>
        {err && <div className="auth-error-banner">{ERROR_MESSAGES[err] || "登入失敗，請重試。"}</div>}
        {/* 這是 API 路由（會轉址到 Google），要整頁跳轉，不能用 <Link> */}
        <a className="auth-google-btn" href="/admin/auth/google">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
          </svg>
          使用 Google 帳號登入
        </a>
        {isAuthTestMode() && (
          // 只有本機 AUTH_TEST_MODE=1 才會出現
          <a className="auth-google-btn" href="/admin/auth/test" style={{ marginTop: 10, background: "#fdf0d5", borderColor: "#f0d9a8" }}>
            🔧 本機測試登入（略過 Google）
          </a>
        )}
        {testStaff.map((s) => (
          <a
            key={s.id}
            className="auth-google-btn"
            href={`/admin/auth/test?staff=${s.id}`}
            style={{ marginTop: 10, background: "#eef6fb", borderColor: "#cfe3f2" }}
          >
            📷 以「{s.name}」攝影師身分測試登入
          </a>
        ))}
      </div>
      <RegisterServiceWorker />
    </div>
  );
}
