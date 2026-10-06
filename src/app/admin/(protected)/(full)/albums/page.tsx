"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../_lib/api";

interface AlbumListItem {
  id: string;
  eventName: string;
  school: string;
  albumUrl: string;
  isOpen: boolean;
}
interface AlbumListResponse {
  items: AlbumListItem[];
}
interface LookupResponse {
  items: string[];
}

type FormFields = {
  eventName: string;
  school: string;
  albumUrl: string;
  isOpen: boolean;
};

const emptyForm: FormFields = { eventName: "", school: "", albumUrl: "", isOpen: true };

export default function AlbumsPage() {
  const [items, setItems] = useState<AlbumListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [schools, setSchools] = useState<string[]>([]);

  const [form, setForm] = useState<FormFields | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<AlbumListResponse>("/albums")
      .then((res) => setItems(res.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get<LookupResponse>("/lookups/events").then((r) => setEvents(r.items)).catch(() => {});
    api.get<LookupResponse>("/lookups/schools").then((r) => setSchools(r.items)).catch(() => {});
  }, []);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2500);
  };

  const toggle = async (album: AlbumListItem) => {
    setToggling(album.id);
    setError(null);
    try {
      const res = await api.post<{ isOpen: boolean }>(`/albums/${encodeURIComponent(album.id)}/toggle`);
      setItems((prev) => prev.map((it) => (it.id === album.id ? { ...it, isOpen: res.isOpen } : it)));
      flash(res.isOpen ? "已開放相簿" : "已關閉相簿");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setToggling(null);
    }
  };

  const openCreate = () => setForm({ ...emptyForm });

  const save = async () => {
    if (!form) return;
    if (!form.eventName.trim() || !form.school.trim() || !form.albumUrl.trim()) {
      setError("請填寫賽事名稱、學校名稱、相簿連結");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/albums", {
        eventName: form.eventName.trim(),
        school: form.school.trim(),
        albumUrl: form.albumUrl.trim(),
        isOpen: form.isOpen ? "Yes" : "No",
      });
      setForm(null);
      flash("已新增相簿連結");
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
          <h1 className="page-title">相簿管理</h1>
          <p className="page-sub">切換各賽事相簿的開放狀態，選手端才能看到已開放的相簿。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>新增相簿連結</button>
      </div>

      {msg && <div className="flash-msg">{msg}</div>}
      {error && <div className="error-hint">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>賽事名稱</th>
              <th>學校</th>
              <th>相簿連結</th>
              <th>開放狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="table-status">載入中…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={5} className="table-status">查無相簿資料</td></tr>}
            {!loading &&
              items.map((album) => (
                <tr key={album.id}>
                  <td className="cell-title" data-label="賽事名稱">{album.eventName || "—"}</td>
                  <td data-label="學校">{album.school || "—"}</td>
                  <td data-label="相簿連結">
                    {album.albumUrl ? (
                      <a className="album-link" href={album.albumUrl} target="_blank" rel="noopener noreferrer">
                        開啟連結
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="開放狀態">
                    <span className={`pill ${album.isOpen ? "pill-registered" : "pill-closed"}`}>
                      {album.isOpen ? "已開放" : "未開放"}
                    </span>
                  </td>
                  <td data-label="操作">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={album.isOpen}
                        disabled={toggling === album.id}
                        onChange={() => toggle(album)}
                      />
                      <span className="slider" />
                    </label>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">新增相簿連結</div>
            <div className="form-field">
              <label>賽事名稱 *</label>
              <select value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })}>
                <option value="">請選擇賽事</option>
                {events.map((ev) => (<option key={ev} value={ev}>{ev}</option>))}
              </select>
            </div>
            <div className="form-field">
              <label>學校名稱 *</label>
              <select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })}>
                <option value="">請選擇學校</option>
                {schools.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="form-field">
              <label>相簿連結 *</label>
              <input type="text" value={form.albumUrl} onChange={(e) => setForm({ ...form, albumUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div className="form-field toggle-field">
              <label>是否開放相簿</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.isOpen}
                  onChange={(e) => setForm({ ...form, isOpen: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setForm(null)}>取消</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? "儲存中…" : "新增"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
