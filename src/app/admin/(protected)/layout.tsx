import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/admin/session";
import { Sidebar } from "./_lib/Sidebar";
// 沿用原 admin-web 的樣式檔（順序同原本的匯入順序）
import "./styles/Sidebar.css";
import "./styles/Topbar.css";
import "./styles/DashboardPage.css";
import "./styles/WeeklyEventsPage.css";
import "./styles/MembersPage.css";
import "./styles/RegistrationsPage.css";
import "./styles/EventMasterPage.css";
import "./styles/AlbumsPage.css";
import "./styles/StaffPage.css";
import "./styles/theme.css";
import "./styles/mobile-ios.css"; // iOS 手機版覆蓋樣式（放最後）

// 受保護的後台：未登入一律導去登入頁（頁面與 /admin/api/* 都會檢查）
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", background: "var(--color-bg-main)" }}>
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          QSPRINT<span>影像報名</span>
        </div>
      </header>
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar role={session.role} name={session.name} albumAccess={!!session.albumAccess} schoolAccess={!!session.schoolAccess} />
        {children}
      </div>
    </div>
  );

}
