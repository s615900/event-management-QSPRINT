import Link from "next/link";
import "../auth-pages.css";

export const metadata = { title: "無權限" };

export default function NoAccessPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- 小圖示，不需最佳化 */}
        <img className="auth-logo" src="/admin/icons/icon-192.png" alt="" />
        <h1>無權限</h1>
        <p>
          您的 Google 帳號不在管理員名單中，或帳號狀態尚未啟用。
          <br />
          如需協助請聯絡系統管理員。
        </p>
        <Link className="auth-google-btn" href="/admin/login">返回登入頁</Link>
      </div>
    </div>
  );
}
