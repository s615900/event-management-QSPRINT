"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../_lib/api";
import "../styles/SponsorsPage.css";

// 贊助清單：選手在贊助頁送出的轉帳回報（Ragic 贊助回報表），新的在前

interface Sponsor {
  id: string;
  name: string;
  amount: number;
  last5: string;
  transferDate: string;
  contact: string;
  note: string;
  replied: boolean;
}

export default function SponsorsClient() {
  const [items, setItems] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "replied">("all");

  useEffect(() => {
    api
      .get<{ items: Sponsor[] }>("/sponsors")
      .then((res) => setItems(res.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const k = q.trim();
    return items.filter(
      (s) =>
        (filter === "all" || (filter === "replied") === s.replied) &&
        (!k || s.name.includes(k) || s.contact.includes(k) || s.last5.includes(k)),
    );
  }, [items, q, filter]);

  const pendingCount = useMemo(() => items.filter((s) => !s.replied).length, [items]);

  // 勾選「已回覆」：先更新畫面，存檔失敗再還原
  const toggleReplied = (s: Sponsor) => {
    const next = !s.replied;
    setError(null);
    setItems((list) => list.map((x) => (x.id === s.id ? { ...x, replied: next } : x)));
    api.patch(`/sponsors/${s.id}`, { replied: next }).catch((err: Error) => {
      setItems((list) => list.map((x) => (x.id === s.id ? { ...x, replied: s.replied } : x)));
      setError(err.message);
    });
  };

  const total = useMemo(() => shown.reduce((sum, s) => sum + s.amount, 0), [shown]);

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">贊助清單</h1>
          <p className="page-sub">選手在贊助頁送出的轉帳回報；用帳號末五碼對帳。</p>
        </div>
      </div>

      {error && <div className="error-hint">{error}</div>}

      <div className="sp-toolbar">
        <div className="sp-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input type="text" value={q} placeholder="搜尋名稱、聯絡方式、末五碼" onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="sp-tabs" role="tablist">
          {(
            [
              ["all", "全部", items.length],
              ["pending", "未回覆", pendingCount],
              ["replied", "已回覆", items.length - pendingCount],
            ] as const
          ).map(([key, label, count]) => (
            <button key={key} type="button" role="tab" aria-selected={filter === key} className={`sp-tab${filter === key ? " active" : ""}`} onClick={() => setFilter(key)}>
              {label}
              <span className="sp-tab-count">{count}</span>
            </button>
          ))}
        </div>

        <div className="sp-stats">
          <div className="sp-stat">
            <div className="sp-stat-label">符合條件筆數</div>
            <div className="sp-stat-value">{shown.length}</div>
          </div>
          <div className="sp-stat">
            <div className="sp-stat-label">合計金額</div>
            <div className="sp-stat-value">NT$ {total.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="staff-list">
        {loading && <div className="staff-empty">載入中…</div>}
        {!loading && shown.length === 0 && <div className="staff-empty">還沒有贊助回報</div>}
        {shown.map((s) => (
          <div key={s.id} className="staff-row">
            <div className="staff-avatar">{s.name.charAt(0)}</div>
            <div className="staff-main">
              <div className="staff-name-line">
                <span className="staff-name">{s.name}</span>
                <span className="pill pill-shot">NT$ {s.amount.toLocaleString()}</span>
                <span className="pill pill-registered">末五碼 {s.last5 || "—"}</span>
                {s.replied && <span className="pill pill-shot">已回覆</span>}
              </div>
              <div className="page-sub" style={{ margin: "4px 0 0" }}>
                {s.transferDate || "未填日期"}・{s.contact || "未填聯絡方式"}
                {s.note && `・${s.note}`}
              </div>
            </div>
            <label className="staff-actions" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={s.replied} onChange={() => toggleReplied(s)} />
              已回覆
            </label>
          </div>
        ))}
      </div>
    </main>
  );
}
