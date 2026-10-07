"use client";

import { useEffect, useState } from "react";
import { api } from "./_lib/api";
import { useRouter } from "next/navigation";
import { VIEW_TO_PATH, type ViewKey } from "./_lib/views";

interface UpcomingEvent {
  date: string;
  eventName: string;
  school: string;
  statusLabel: string;
}
interface RecentMember {
  playerName: string;
  phone: string;
  school: string;
  eventName: string;
  date: string;
}
interface MasterEvent {
  eventName: string;
  startDate: string;
  endDate: string;
}
interface DashboardData {
  weeklyEventCount: number;
  newMembersThisMonth: number;
  totalMembers: number | null; // 攝影師帳號為 null
  albumsPendingCount: number;
  upcomingEvents: UpcomingEvent[];
  recentMembers: RecentMember[];
  masterEvents: MasterEvent[];
  viewer?: { role: "admin" | "staff"; name: string };
}

const STATUS_PILL: Record<string, string> = {
  報名中: "pill-registered",
  籌備中: "pill-pending",
  尚未開放: "pill-shot",
  已結束: "pill-closed",
};

function StatIcon({ type, color }: { type: string; color: string }) {
  if (type === "userPlus") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </svg>
    );
  }
  if (type === "users") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function dateParts(iso: string): { month: string; day: string } {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(iso);
  if (!m) return { month: "—", day: "—" };
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { month: months[Number(m[2]) - 1] ?? "—", day: String(Number(m[3])) };
}

export default function DashboardPage() {
  const router = useRouter();
  const onNavigate = (key: ViewKey) => router.push(VIEW_TO_PATH[key]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>("/dashboard")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <main className="main">
        <h1 className="page-title">儀表板</h1>
        <div className="error-hint">載入失敗：{error}</div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="main">
        <h1 className="page-title">儀表板</h1>
        <div className="loading-hint">載入中…</div>
      </main>
    );
  }

  // 攝影師帳號只能看儀表板和自己的行程：不顯示總選手數、近期選手，也不顯示通往其他管理頁的按鈕
  const isStaff = data.viewer?.role === "staff";

  const allStats = [
    { key: "weekly", label: "本週賽事", value: data.weeklyEventCount, iconBg: "var(--color-pending-bg)", iconColor: "#B5790A", icon: "calendar" },
    { key: "newMembers", label: "本月新選手", value: data.newMembersThisMonth, iconBg: "var(--color-success-bg)", iconColor: "#1F8A55", icon: "userPlus" },
    { key: "totalMembers", label: "總選手數", value: data.totalMembers, iconBg: "var(--color-info-bg)", iconColor: "#0E3A5C", icon: "users" },
    { key: "albumsPending", label: "待開放相簿", value: data.albumsPendingCount, iconBg: "#F0E3F7", iconColor: "#8A4FA0", icon: "calendar" },
  ];
  const stats = isStaff ? allStats.filter((s) => s.key !== "totalMembers") : allStats;

  const masterEventList = data.masterEvents.slice(0, 4);

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">儀表板</h1>
          <p className="page-sub">歡迎回到 QSPRINT 影像報名系統，這是目前的最新概況。</p>
        </div>
        {isStaff ? (
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("my-schedule")}>
            我的拍攝行程
          </button>
        ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={() => onNavigate("members")}>
            選手管理
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("registrations")}>
            賽事報名資料
          </button>
        </div>
        )}
      </div>

      <div className={`stat-grid${isStaff ? " stat-grid-3" : ""}`}>
        {stats.map((s) => (
          <div className="card" key={s.key}>
            <div className="stat-top">
              <span className="stat-label">{s.label}</span>
              <div className="icon-circle" style={{ background: s.iconBg }}>
                <StatIcon type={s.icon} color={s.iconColor} />
              </div>
            </div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={isStaff ? { gridTemplateColumns: "1fr" } : undefined}>
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">近期賽事</span>
            {!isStaff && (
              <button type="button" className="panel-link" onClick={() => onNavigate("weekly-events")}>
                查看全部 →
              </button>
            )}
          </div>
          {data.upcomingEvents.length === 0 && <div className="empty-slot">近期尚無賽事</div>}
          {data.upcomingEvents.map((ev, i) => {
            const d = dateParts(ev.date);
            return (
              <div className="row" key={i}>
                <div className="date-box">
                  {d.month}
                  <div className="day">{d.day}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="row-title">{ev.eventName}</div>
                  <div className="row-sub">{ev.school}</div>
                </div>
                <span className={`pill ${STATUS_PILL[ev.statusLabel] ?? "pill-shot"}`}>{ev.statusLabel}</span>
              </div>
            );
          })}
        </div>

        {!isStaff && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">近期選手</span>
            {!isStaff && (
              <button type="button" className="panel-link" onClick={() => onNavigate("members")}>
                查看全部 →
              </button>
            )}
          </div>
          {data.recentMembers.length === 0 && <div className="empty-slot">尚無選手資料</div>}
          {data.recentMembers.map((m, i) => (
            <div className="row" key={i}>
              <div className="avatar">{(m.playerName || "？").slice(0, 1)}</div>
              <div style={{ flex: 1 }}>
                <div className="row-title">{m.playerName}</div>
                <div className="row-sub">{[m.phone, m.eventName].filter(Boolean).join(" · ")}</div>
              </div>
              <div>
                {m.school && <span className="tag-city">{m.school}</span>}
                <div className="row-date">{m.date}</div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      <div className="events-head">
        <div>
          <h2 className="events-title">近期賽事總覽</h2>
          <p className="events-sub">依賽事名稱檢視各賽事的場次概況。</p>
        </div>
      </div>

      <div className="event-grid">
        {masterEventList.length === 0 && <div className="empty-slot">近期尚無賽事</div>}
        {masterEventList.map((ev, idx) => (
          <div className={`event-col${idx === 0 ? " highlight" : ""}`} key={`${ev.eventName}-${ev.startDate}`}>
            <div className="event-col-head event-col-head-only">
              <div className="event-name">{ev.eventName}</div>
              <div className="event-date">
                {ev.startDate === ev.endDate || !ev.endDate
                  ? ev.startDate || "—"
                  : `${ev.startDate} – ${ev.endDate}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
