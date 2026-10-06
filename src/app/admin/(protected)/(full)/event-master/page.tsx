"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../_lib/api";

interface EventListItem {
  id: string;
  eventName: string;
  startDate: string;
  endDate: string;
  school: string;
  albumStatus: "開放" | "未開放" | "尚無相簿";
  status: string;
  openForRegistration: boolean;
}
interface EventListResponse {
  items: EventListItem[];
  total: number;
}

type FormFields = {
  eventName: string;
  startDate: string;
  endDate: string;
  openForRegistration: boolean;
};

const emptyForm: FormFields = { eventName: "", startDate: "", endDate: "", openForRegistration: true };

export default function EventMasterPage() {
  const [items, setItems] = useState<EventListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState<FormFields | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ q });
    api
      .get<EventListResponse>(`/events?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2500);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
  };

  const openEdit = (item: EventListItem) => {
    setEditId(item.id);
    setForm({
      eventName: item.eventName,
      startDate: item.startDate,
      endDate: item.endDate,
      openForRegistration: item.openForRegistration,
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.eventName.trim() || !form.startDate || !form.endDate) {
      setError("請填寫賽事名稱、開始日期、結束日期");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      eventName: form.eventName.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      openForRegistration: form.openForRegistration ? "Yes" : "No",
    };
    try {
      if (editId) {
        await api.patch(`/events/${encodeURIComponent(editId)}`, body);
        flash("已儲存");
      } else {
        await api.post("/events", body);
        flash("已新增賽事");
      }
      setForm(null);
      setEditId(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">賽事資訊總表</h1>
          <p className="page-sub">賽事主檔管理，新增賽事並設定是否開放報名。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>新增賽事</button>
      </div>

      <div className="toolbar">
        <input
          className="toolbar-input"
          type="text"
          placeholder="搜尋賽事名稱"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button type="button" className="btn btn-primary" onClick={load}>搜尋</button>
      </div>

      {msg && <div className="flash-msg">{msg}</div>}
      {error && <div className="error-hint">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>賽事名稱</th>
              <th>日期</th>
              <th>開放報名</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="table-status">載入中…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={4} className="table-status">查無符合條件的賽事資料</td></tr>}
            {!loading &&
              items.map((item) => (
                <tr key={item.id}>
                  <td className="cell-title" data-label="賽事名稱">{item.eventName || "（未填賽事名稱）"}</td>
                  <td data-label="日期">
                    {item.startDate === item.endDate || !item.endDate
                      ? item.startDate || "—"
                      : `${item.startDate} ~ ${item.endDate}`}
                  </td>
                  <td data-label="開放報名">{item.openForRegistration ? "是" : "否"}</td>
                  <td data-label="操作">
                    <div className="cell-actions">
                      <button type="button" className="link-btn" onClick={() => openEdit(item)}>編輯</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="pager-info">共 {total} 筆</span>
      </div>

      {form && (
        <div className="modal-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editId ? "編輯賽事" : "新增賽事"}</div>
            <div className="form-field">
              <label>賽事名稱 *</label>
              <input type="text" value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} />
            </div>
            <div className="form-field">
              <label>開始日期 *</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="form-field">
              <label>結束日期 *</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="form-field toggle-field">
              <label>是否開放報名</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.openForRegistration}
                  onChange={(e) => setForm({ ...form, openForRegistration: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setForm(null)}>取消</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? "儲存中…" : editId ? "儲存" : "新增"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
