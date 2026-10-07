"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../_lib/api";
import { COUNTIES, countyRank } from "@/lib/counties";

// 學校名單管理：選手報名頁與後台下拉選單用的學校清單（Ragic 國高中職學校清單）

const TYPES = ["國中", "高中", "大學"];

interface School {
  id: string;
  name: string;
  type: string;
  county: string;
}

export default function SchoolsClient() {
  const [items, setItems] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [countyFilter, setCountyFilter] = useState("");
  const [form, setForm] = useState<{ name: string; type: string; county: string } | null>(null);
  const [editing, setEditing] = useState<School | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<{ items: School[] }>("/schools")
      .then((res) => setItems(res.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2500);
  };

  const shown = useMemo(() => {
    const order: Record<string, number> = { 國中: 1, 高中: 2, 大學: 3 };
    return items
      .filter((s) => (!typeFilter || s.type === typeFilter) && (!countyFilter || s.county === countyFilter) && (!q.trim() || s.name.includes(q.trim())))
      .sort(
        (a, b) =>
          countyRank(a.county) - countyRank(b.county) ||
          (order[a.type] || 9) - (order[b.type] || 9) ||
          a.name.localeCompare(b.name, "zh-TW"),
      );
  }, [items, q, typeFilter, countyFilter]);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setForm({ name: "", type: TYPES[1], county: "" });
  };

  const openEdit = (s: School) => {
    setEditing(s);
    setError(null);
    setForm({ name: s.name, type: s.type, county: s.county });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      setError("請填寫學校名稱");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/schools/${editing.id}`, form);
        flash("已更新");
      } else {
        await api.post("/schools", form);
        flash("已新增");
      }
      setForm(null);
      setEditing(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: School) => {
    if (!window.confirm(`確定要刪除「${s.name}」嗎？已經報名的紀錄不會受影響，但新的報名就選不到這間學校。`)) return;
    setError(null);
    try {
      await api.del(`/schools/${s.id}`);
      flash("已刪除");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">學校名單管理</h1>
          <p className="page-sub">管理選手報名時可以選的學校；依縣市（由北到南）排序，同縣市再依學籍（國中 → 高中 → 大學）。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>新增學校</button>
      </div>

      {msg && <div className="flash-msg">{msg}</div>}
      {error && !form && <div className="error-hint">{error}</div>}

      <div className="filter-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          type="text"
          value={q}
          placeholder="搜尋學校名稱"
          style={{ flex: "1 1 200px" }}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">全部學籍</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={countyFilter} onChange={(e) => setCountyFilter(e.target.value)}>
          <option value="">全部縣市</option>
          {COUNTIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="staff-list">
        <div className="staff-list-head">
          共 {items.length} 間學校{shown.length !== items.length && `・符合條件 ${shown.length} 間`}
        </div>
        {loading && <div className="staff-empty">載入中…</div>}
        {!loading && shown.length === 0 && <div className="staff-empty">沒有學校，點右上角「新增學校」開始</div>}
        {!loading &&
          shown.map((s) => (
            <div key={s.id} className="staff-row">
              <div className="staff-avatar">{s.name.charAt(0)}</div>
              <div className="staff-main">
                <div className="staff-name-line">
                  <button type="button" className="staff-name" onClick={() => openEdit(s)}>{s.name}</button>
                  {s.county && <span className="pill pill-registered">{s.county}</span>}
                  {s.type && <span className="pill pill-shot">{s.type}</span>}
                </div>
              </div>
              <div className="staff-actions">
                <button type="button" className="btn btn-outline" style={{ padding: "6px 14px" }} onClick={() => openEdit(s)}>編輯</button>
                <button type="button" className="link-btn danger" onClick={() => remove(s)}>刪除</button>
              </div>
            </div>
          ))}
      </div>

      {form && (
        <div className="modal-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editing ? `編輯「${editing.name}」` : "新增學校"}</div>
            <div className="form-field">
              <label>學校名稱 *</label>
              <input type="text" value={form.name} placeholder="例：臺北市立建國高級中學" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-field">
              <label>縣市</label>
              <select value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}>
                <option value="">未選擇</option>
                {form.county && !COUNTIES.includes(form.county) && <option>{form.county}</option>}
                {COUNTIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>學籍</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {form.type && !TYPES.includes(form.type) && <option>{form.type}</option>}
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            {error && <div className="error-hint" style={{ padding: "0 0 12px" }}>{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setForm(null)}>取消</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? "儲存中…" : editing ? "儲存" : "新增"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
