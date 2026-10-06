"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../_lib/api";

// 攝影師管理（參考 studio-nextjs 的人員管理）：選手在 LINE 報名頁會從這份名單挑攝影師

const ROLES = ["攝影師", "小編"];

interface StaffMember {
  id: number;
  name: string;
  role: string;
  phone: string;
  notes: string;
  email: string;
  adminAccess: boolean;
  albumAccess: boolean;
  active: boolean;
  pick_count: number;
  upcoming_count: number;
}

type FormFields = {
  name: string;
  role: string;
  phone: string;
  notes: string;
  email: string;
  adminAccess: boolean;
  albumAccess: boolean;
};
const emptyForm: FormFields = { name: "", role: ROLES[0], phone: "", notes: "", email: "", adminAccess: false, albumAccess: false };

export default function PhotographersPage() {
  const [items, setItems] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<{ items: StaffMember[] }>("/staff?include_inactive=true")
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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
  };

  const openEdit = (m: StaffMember) => {
    setEditing(m);
    setError(null);
    setForm({ name: m.name, role: m.role, phone: m.phone, notes: m.notes, email: m.email, adminAccess: m.adminAccess, albumAccess: m.albumAccess });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      setError("請填寫名稱");
      return;
    }
    if (form.adminAccess && !form.email.trim()) {
      setError("要開放後台權限，請填寫這位人員的 Google Email");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/staff/${editing.id}`, form);
        flash("已更新");
      } else {
        await api.post("/staff", form);
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

  const toggleActive = async (m: StaffMember) => {
    const next = !m.active;
    if (
      !next &&
      m.upcoming_count > 0 &&
      !window.confirm(
        `${m.name} 還有 ${m.upcoming_count} 筆即將到來的賽事被選手選了。停用後這些紀錄仍會保留他的名字，但新的報名就選不到他了。確定停用？`,
      )
    ) {
      return;
    }
    setBusyId(m.id);
    setError(null);
    try {
      await api.patch(`/staff/${m.id}`, { active: next });
      setItems((prev) => prev.map((it) => (it.id === m.id ? { ...it, active: next } : it)));
      flash(next ? `${m.name} 已恢復` : `${m.name} 已停用`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: StaffMember) => {
    if (!window.confirm(`確定要刪除 ${m.name} 嗎？`)) return;
    setError(null);
    try {
      await api.del(`/staff/${m.id}`);
      flash("已刪除");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const activeCount = items.filter((m) => m.active).length;
  const pickableCount = items.filter((m) => m.active && m.role === "攝影師").length;

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">攝影師管理</h1>
          <p className="page-sub">管理攝影師與工作人員；職務為「攝影師」且在職的人，選手報名時才選得到。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>新增人員</button>
      </div>

      {msg && <div className="flash-msg">{msg}</div>}
      {error && <div className="error-hint">{error}</div>}

      <div className="staff-list">
        <div className="staff-list-head">
          在職 {activeCount} 位（選手可挑選的攝影師 {pickableCount} 位）
          {items.length > activeCount && `・已停用 ${items.length - activeCount} 位`}
        </div>
        {loading && <div className="staff-empty">載入中…</div>}
        {!loading && items.length === 0 && <div className="staff-empty">還沒有人員，點右上角「新增人員」開始</div>}
        {!loading &&
          items.map((m) => (
            <div key={m.id} className={`staff-row${m.active ? "" : " inactive"}`}>
              <div className="staff-avatar">{m.name.charAt(0)}</div>
              <div className="staff-main">
                <div className="staff-name-line">
                  <button type="button" className="staff-name" onClick={() => openEdit(m)}>{m.name}</button>
                  <span className="pill pill-shot">{m.role}</span>
                  {m.adminAccess && <span className="pill pill-registered">後台權限</span>}
                  {m.adminAccess && m.albumAccess && <span className="pill pill-registered">相簿權限</span>}
                  {!m.active && <span className="pill pill-closed">已停用</span>}
                </div>
                <div className="staff-meta">
                  {m.phone && <span>📞 {m.phone}</span>}
                  {m.email && <span>✉️ {m.email}</span>}
                  <span>被選手選擇：即將到來 {m.upcoming_count} 筆・累計 {m.pick_count} 筆</span>
                  {m.notes && <span>📝 {m.notes}</span>}
                </div>
              </div>
              <div className="staff-actions">
                <label className="staff-active-label">
                  <span className="switch">
                    <input type="checkbox" checked={m.active} disabled={busyId === m.id} onChange={() => toggleActive(m)} />
                    <span className="slider" />
                  </span>
                  {m.active ? "在職" : "停用"}
                </label>
                <button type="button" className="btn btn-outline" style={{ padding: "6px 14px" }} onClick={() => openEdit(m)}>編輯</button>
                <button
                  type="button"
                  className="link-btn danger"
                  disabled={m.pick_count > 0}
                  title={m.pick_count > 0 ? "已被選手選過的人員不能刪除，請改用停用" : "刪除"}
                  style={m.pick_count > 0 ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
                  onClick={() => remove(m)}
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
      </div>

      <p className="page-sub" style={{ marginTop: 12 }}>已被選手選過的人員不能刪除，請用「停用」：舊紀錄會保留他的名字，新的報名就選不到他。</p>

      {form && (
        <div className="modal-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editing ? `編輯「${editing.name}」` : "新增人員"}</div>
            <div className="form-field">
              <label>名稱 *（選手報名頁會顯示這個名字）</label>
              <input type="text" value={form.name} placeholder="例：陳攝影師" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-field">
              <label>職務</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {!ROLES.includes(form.role) && <option>{form.role}</option>}
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>電話</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Google Email{form.adminAccess ? " *" : ""}（開放後台權限時用來登入）</label>
              <input type="email" value={form.email} placeholder="例：photographer@gmail.com" onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-field toggle-field">
              <label>後台權限（可以用 Google 登入這個後台）</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.adminAccess}
                  onChange={(e) => setForm({ ...form, adminAccess: e.target.checked, albumAccess: e.target.checked && form.albumAccess })}
                />
                <span className="slider" />
              </label>
            </div>
            {form.adminAccess && (
              <div className="form-field toggle-field">
                <label>相簿權限（可以管理自己被選到的賽事相簿：貼連結、開放、通知選手）</label>
                <label className="switch">
                  <input type="checkbox" checked={form.albumAccess} onChange={(e) => setForm({ ...form, albumAccess: e.target.checked })} />
                  <span className="slider" />
                </label>
              </div>
            )}
            {form.adminAccess && (
              <p className="page-sub" style={{ marginTop: -6, marginBottom: 12 }}>開放後，這位人員用 Google 登入後台，只能看到「儀表板」和「我的拍攝行程」；再打開「相簿權限」會多一個「我的相簿」，只能管理自己的相簿。</p>
            )}
            {error && <div className="error-hint" style={{ padding: "0 0 12px" }}>{error}</div>}
            <div className="form-field">
              <label>備註</label>
              <input type="text" value={form.notes} placeholder="例：擅長徑賽、只接週末" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
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
