"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PATH_TO_VIEW, VIEW_TO_PATH, type ViewKey } from "./views";

const eventNavItems: Array<{ key: ViewKey; label: string }> = [
  { key: "weekly-events", label: "本週賽事" },
  { key: "members", label: "選手管理" },
  { key: "registrations", label: "賽事報名資料" },
  { key: "event-master", label: "賽事資訊總表" },
  { key: "albums", label: "相簿管理" },
  { key: "photographers", label: "攝影師管理" },
  { key: "admins", label: "管理員權限" },
];

const integrations = [
  { key: "line-login", label: "LINE Login 會員綁定", connected: true },
  { key: "ragic", label: "RAGIC 資料庫串接", connected: true },
  { key: "google-admin", label: "Google 帳號登入（管理員）", connected: true },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// role="staff"（有後台權限的攝影師）只顯示儀表板和我的拍攝行程
export function Sidebar({ role = "admin", name = "" }: { role?: "admin" | "staff"; name?: string }) {
  const isStaff = role === "staff";
  const pathname = usePathname();
  const router = useRouter();
  const activeKey: ViewKey = PATH_TO_VIEW[pathname] ?? "dashboard";
  const onNavigate = (key: ViewKey) => router.push(VIEW_TO_PATH[key]);
  const [eventGroupOpen, setEventGroupOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const go = (key: ViewKey) => {
    setDrawerOpen(false);
    onNavigate(key);
  };

  return (
    <>
      <button type="button" className="sidebar-toggle" aria-label="開啟選單" onClick={() => setDrawerOpen(true)}>
        ☰
      </button>
      <div className={`sidebar-backdrop${drawerOpen ? " show" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`sidebar${drawerOpen ? " open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7FC3F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 4l3 3-9 9-4 1 1-4 9-9z" />
              <path d="M2 20h20" />
            </svg>
          </div>
          <div className="brand-name">QSPRINT <span>影像報名</span></div>
        </div>

        <nav className="nav">
          <button
            type="button"
            className={`top-item${activeKey === "dashboard" ? " active" : ""}`}
            onClick={() => go("dashboard")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            儀表板
          </button>

          {isStaff ? (
            <div className="group-body">
              <button
                type="button"
                className={`pill-item${activeKey === "my-schedule" ? " active" : ""}`}
                onClick={() => go("my-schedule")}
              >
                我的拍攝行程
              </button>
            </div>
          ) : (
          <>
          <button type="button" className="group-head" onClick={() => setEventGroupOpen((o) => !o)}>
            <span>賽事管理系統</span>
            <ChevronIcon open={eventGroupOpen} />
          </button>
          {eventGroupOpen && (
            <div className="group-body">
              {eventNavItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`pill-item${activeKey === item.key ? " active" : ""}`}
                  onClick={() => go(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="settings-group">
            <button type="button" className="settings-head" onClick={() => setSettingsOpen((o) => !o)}>
              <span>設定</span>
              <ChevronIcon open={settingsOpen} />
            </button>
            {settingsOpen &&
              integrations.map((item) => (
                <div key={item.key} className="int-item">
                  <span className="int-label">{item.label}</span>
                  <span className={`tag ${item.connected ? "tag-on" : "tag-off"}`}>
                    {item.connected ? "已連接" : "未連接"}
                  </span>
                </div>
              ))}
          </div>

          </>
          )}

          <div className="sidebar-footer">
            {name && (
              <div className="int-label" style={{ padding: "0 4px 10px", opacity: 0.8 }}>
                {name}（{isStaff ? "攝影師" : "管理員"}）
              </div>
            )}
            <button
              type="button"
              className="logout-btn"
              onClick={() => {
                window.location.href = "/admin/auth/logout";
              }}
            >
              登出
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
