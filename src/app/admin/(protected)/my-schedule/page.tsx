"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../_lib/api";

// 攝影師自己的拍攝行程：選手報名時選了這位攝影師的場次

interface ScheduleItem {
  playerName: string;
  eventName: string;
  date: string;
  time: string;
  itemCategory: string;
  eventItem: string;
  bibNumber: string;
  school: string;
  group: string;
}
interface ScheduleResponse {
  name: string;
  isStaff: boolean;
  today: string;
  items: ScheduleItem[];
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
function dateLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date || "—";
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}（週${WEEKDAYS[w]}）`;
}

export default function MySchedulePage() {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  // 篩選器
  const [eventFilter, setEventFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get<ScheduleResponse>("/my-schedule").then(setData).catch((err: Error) => setError(err.message));
  }, []);

  const upcoming = useMemo(() => data?.items.filter((i) => i.date >= data.today) ?? [], [data]);
  const past = useMemo(() => (data?.items.filter((i) => i.date < data.today) ?? []).reverse(), [data]);
  const base = showPast ? past : upcoming;

  // 下拉選單只列出目前這一頁（即將到來／已結束）裡有的值
  const options = useMemo(() => {
    const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-TW"));
    return {
      events: uniq(base.map((i) => i.eventName)),
      dates: [...new Set(base.map((i) => i.date).filter(Boolean))],
      categories: uniq(base.map((i) => i.itemCategory)),
      schools: uniq(base.map((i) => i.school)),
    };
  }, [base]);

  const kw = q.trim().toLowerCase();
  const list = base.filter(
    (i) =>
      (!eventFilter || i.eventName === eventFilter) &&
      (!dateFilter || i.date === dateFilter) &&
      (!categoryFilter || i.itemCategory === categoryFilter) &&
      (!schoolFilter || i.school === schoolFilter) &&
      (!kw || `${i.playerName} ${i.bibNumber}`.toLowerCase().includes(kw)),
  );
  const filtering = !!(eventFilter || dateFilter || categoryFilter || schoolFilter || kw);
  const clearFilters = () => {
    setEventFilter("");
    setDateFilter("");
    setCategoryFilter("");
    setSchoolFilter("");
    setQ("");
  };
  const switchTab = (past: boolean) => {
    setShowPast(past);
    clearFilters();
  };

  // 依日期分組
  const groups = new Map<string, ScheduleItem[]>();
  for (const it of list) {
    if (!groups.has(it.date)) groups.set(it.date, []);
    groups.get(it.date)!.push(it);
  }

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">我的拍攝行程</h1>
          <p className="page-sub">選手報名時選了你的場次{data?.isStaff ? `（${data.name}）` : ""}。</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className={`btn ${showPast ? "btn-outline" : "btn-primary"}`} onClick={() => switchTab(false)}>
            即將到來 {data ? upcoming.length : ""}
          </button>
          <button type="button" className={`btn ${showPast ? "btn-primary" : "btn-outline"}`} onClick={() => switchTab(true)}>
            已結束 {data ? past.length : ""}
          </button>
        </div>
      </div>

      {data?.isStaff && base.length > 0 && (
        <div className="toolbar">
          <input
            className="toolbar-input"
            type="text"
            placeholder="搜尋選手姓名 / 號碼"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="toolbar-select" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="">全部賽事</option>
            {options.events.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select className="toolbar-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="">全部日期</option>
            {options.dates.map((v) => <option key={v} value={v}>{dateLabel(v)}</option>)}
          </select>
          <select className="toolbar-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">全部項目分類</option>
            {options.categories.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select className="toolbar-select" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
            <option value="">全部學校</option>
            {options.schools.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {filtering && (
            <button type="button" className="btn btn-outline" onClick={clearFilters}>清除篩選</button>
          )}
        </div>
      )}
      {filtering && <p className="page-sub" style={{ marginBottom: 12 }}>符合條件 {list.length} 筆</p>}

      {error && <div className="error-hint">載入失敗：{error}</div>}
      {!error && !data && <div className="loading-hint">載入中…</div>}
      {data && !data.isStaff && (
        <div className="loading-hint">這一頁是給有後台權限的攝影師看自己的行程；管理員請到「賽事報名資料」查看所有報名。</div>
      )}
      {data?.isStaff && list.length === 0 && (
        <div className="staff-list">
          <div className="staff-empty">
            {filtering ? "沒有符合篩選條件的行程" : showPast ? "還沒有已結束的行程" : "目前沒有即將到來的行程"}
          </div>
        </div>
      )}

      {[...groups.entries()].map(([date, items]) => (
        <div key={date} style={{ marginBottom: 18 }}>
          <h2 className="events-title" style={{ fontSize: 16, marginBottom: 8 }}>
            {dateLabel(date)} <span className="page-sub" style={{ fontWeight: 400 }}>{items.length} 位選手</span>
          </h2>
          <div className="staff-list">
            {items.map((it, i) => (
              <div className="staff-row" key={i}>
                <div className="staff-avatar" style={{ width: 56, borderRadius: 10, fontSize: 13 }}>{it.time || "—"}</div>
                <div className="staff-main">
                  <div className="staff-name-line">
                    <span className="staff-name" style={{ cursor: "default" }}>{it.playerName || "（未填姓名）"}</span>
                    {it.bibNumber && <span className="pill pill-shot">#{it.bibNumber}</span>}
                  </div>
                  <div className="staff-meta">
                    <span>🏆 {it.eventName}</span>
                    <span>🏃 {[it.itemCategory, it.eventItem].filter(Boolean).join(" ") || "—"}</span>
                    {it.school && <span>🏫 {it.school}</span>}
                    {it.group && <span>👥 {it.group}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
