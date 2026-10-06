"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../_lib/api";

// 管理員權限：誰可以用 Google 帳號登入後台。
// 「管理員」存在 Ragic 的後台網站管理員清單；「攝影師帳號」是在攝影師管理勾了後台權限的人。

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  active: boolean;
}
interface StaffAdmin {
  id: number;
  name: string;
  role: string;
  email: string;
  active: boolean;
}
interface AdminsResponse {
  admins: AdminAccount[];
  staff: StaffAdmin[];
  me: string;
}

type FormFields = { name: string; email: string };

export default function AdminsPage() {
  const [data, setData] = useState<AdminsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields | null>(null);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<AdminsResponse>("/admins")
      .then(setData)
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

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.email.trim()) {
      setError("請填寫姓名與 Google Email");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/admins/${editing.id}`, form);
        flash("已更新");
      } else {
        await api.post("/admins", form);
        flash("已新增管理員");
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

  const toggle = async (a: AdminAccount) => {
    if (a.active && !window.confirm(`確定停用 ${a.name}？停用後他就不能登入後台。`)) return;
    setBusyId(a.id);
    setError(null);
    try {
      await api.patch(`/admins/${a.id}`, { active: !a.active });
      flash(a.active ? `${a.name} 已停用` : `${a.name} 已啟用`);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const me = data?.me ?? "";

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">管理員權限</h1>
          <p className="page-sub">設定誰可以用 Google 帳號登入這個後台。管理員資料存在 Ragic 的「後台網站管理員清單」。</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setError(null);
            setForm({ name: "", email: "" });
          }}
        >
          新增管理員
        </button>
      </div>

      {msg && <div className="flash-msg">{msg}</div>}
      {error && !form && <div className="error-hint">{error}</div>}

      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>姓名</th>
              <th>Google Email</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={4} className="table-status">載入中…</td></tr>}
            {data && data.admins.length === 0 && <tr><td colSpan={4} className="table-status">尚無管理員</td></tr>}
            {data?.admins.map((a) => {
              const isMe = a.email === me;
              return (
                <tr key={a.id} style={a.active ? undefined : { opacity: 0.6 }}>
                  <td className="cell-title" data-label="姓名">
                    {a.name || "—"} {isMe && <span className="pill pill-shot" style={{ marginLeft: 6 }}>你</span>}
                  </td>
                  <td data-label="Google Email">{a.email || "—"}</td>
                  <td data-label="狀態">
                    <span className={`pill ${a.active ? "pill-registered" : "pill-closed"}`}>{a.active ? "啟用" : "停用"}</span>
                  </td>
                  <td data-label="操作">
                    <div className="cell-actions">
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: "6px 12px" }}
                        onClick={() => {
                          setEditing(a);
                          setError(null);
                          setForm({ name: a.name, email: a.email });
                        }}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        className={`link-btn${a.active ? " danger" : ""}`}
                        disabled={isMe || busyId === a.id}
                        title={isMe ? "不能停用自己正在登入的帳號" : undefined}
                        style={isMe ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
                        onClick={() => toggle(a)}
                      >
                        {a.active ? "停用" : "啟用"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="events-head" style={{ marginTop: 28 }}>
        <div>
          <h2 className="events-title">攝影師帳號</h2>
          <p className="events-sub">
            在「<Link href="/admin/photographers" className="link-btn">攝影師管理</Link>」打開後台權限的人員，也能用 Google 登入後台，但只能看儀表板和自己的拍攝行程；要修改請到攝影師管理。
          </p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>名稱</th>
              <th>職務</th>
              <th>Google Email</th>
              <th>可否登入</th>
            </tr>
          </thead>
          <tbody>
            {data && data.staff.length === 0 && (
              <tr><td colSpan={4} className="table-status">目前沒有攝影師開放後台權限</td></tr>
            )}
            {data?.staff.map((s) => (
              <tr key={s.id}>
                <td className="cell-title" data-label="名稱">{s.name}</td>
                <td data-label="職務">{s.role}</td>
                <td data-label="Google Email">{s.email}</td>
                <td data-label="可否登入">
                  <span className={`pill ${s.active ? "pill-registered" : "pill-closed"}`}>{s.active ? "可登入" : "已停用，不能登入"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editing ? `編輯「${editing.name}」` : "新增管理員"}</div>
            <div className="form-field">
              <label>姓名 *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Google Email *（用這個帳號登入後台）</label>
              <input
                type="email"
                value={form.email}
                disabled={!!editing && editing.email === me}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {editing && editing.email === me && <p className="page-sub" style={{ marginTop: -6 }}>不能修改自己正在登入的 Email。</p>}
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
