"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../_lib/api";

interface MemberListItem {
  id: string;
  playerNumber: string;
  playerName: string;
  school: string;
  group: string;
  phone: string;
  ig: string;
  email: string;
  lineName: string;
  lineBound: boolean;
  accountStatus: string;
  createdDate: string;
  itemTags: string[];
}
interface MemberListResponse {
  items: MemberListItem[];
  total: number;
  hasMore: boolean;
}
interface FilterOptions {
  schools: string[];
  groups: string[];
}

const GROUP_OPTIONS = ["高中男生", "高中女生", "公開男生", "公開女生"];
const PAGE_SIZE = 20;

interface EditState {
  id: string;
  playerName: string;
  phone: string;
  school: string;
  group: string;
}

export default function MembersPage() {
  const [items, setItems] = useState<MemberListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [school, setSchool] = useState("");
  const [group, setGroup] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [options, setOptions] = useState<FilterOptions>({ schools: [], groups: [] });
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      q,
      school,
      group,
      order,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    api
      .get<MemberListResponse>(`/members?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setHasMore(res.hasMore);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [q, school, group, order, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get<FilterOptions>("/members/filters/options")
      .then(setOptions)
      .catch(() => {});
  }, []);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2500);
  };

  const openEdit = async (id: string) => {
    setError(null);
    try {
      const d = await api.get<MemberListItem>(`/members/${encodeURIComponent(id)}`);
      setEdit({ id: d.id, playerName: d.playerName, phone: d.phone, school: d.school, group: d.group });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!edit.playerName.trim() || !edit.phone.trim()) {
      setError("請填寫姓名、聯絡電話");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/members/${encodeURIComponent(edit.id)}`, {
        playerName: edit.playerName.trim(),
        phone: edit.phone.trim(),
        school: edit.school,
        group: edit.group,
      });
      setEdit(null);
      flash("已儲存");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (m: MemberListItem) => {
    setError(null);
    try {
      const res = await api.post<{ accountStatus: string }>(
        `/members/${encodeURIComponent(m.id)}/toggle-status`,
      );
      setItems((prev) =>
        prev.map((it) => (it.id === m.id ? { ...it, accountStatus: res.accountStatus } : it)),
      );
      flash(res.accountStatus === "啟用" ? "已啟用帳號" : "已停用帳號");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError((err as Error).message);
    }
  };

  const applySearch = () => setPage(0);

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">選手管理</h1>
          <p className="page-sub">搜尋、篩選選手資料，編輯基本資料或切換帳號狀態。</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="toolbar-input"
          type="text"
          placeholder="搜尋姓名 / 電話 / 選手編號"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
        />
        <select className="toolbar-select" value={school} onChange={(e) => { setSchool(e.target.value); setPage(0); }}>
          <option value="">全部學校</option>
          {options.schools.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="toolbar-select" value={group} onChange={(e) => { setGroup(e.target.value); setPage(0); }}>
          <option value="">全部組別</option>
          {options.groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <button type="button" className="btn btn-outline" onClick={() => { setOrder((o) => (o === "desc" ? "asc" : "desc")); setPage(0); }}>
          建檔時間 {order === "desc" ? "↓" : "↑"}
        </button>
        <button type="button" className="btn btn-primary" onClick={applySearch}>搜尋</button>
      </div>

      {msg && <div className="flash-msg">{msg}</div>}
      {error && <div className="error-hint">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>選手編號</th>
              <th>選手姓名</th>
              <th>學校</th>
              <th>組別</th>
              <th>IG</th>
              <th>Email</th>
              <th>LINE 名稱</th>
              <th>LINE 連結狀態</th>
              <th>帳號狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="table-status">載入中…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={10} className="table-status">查無資料</td></tr>}
            {!loading &&
              items.map((m) => (
                <tr key={m.id}>
                  <td data-label="選手編號">{m.playerNumber || "—"}</td>
                  <td className="cell-title" data-label="選手姓名">{m.playerName || "（未填姓名）"}</td>
                  <td data-label="學校">{m.school || "—"}</td>
                  <td data-label="組別">{m.group || "—"}</td>
                  <td data-label="IG">{m.ig || "—"}</td>
                  <td data-label="Email">{m.email || "—"}</td>
                  <td data-label="LINE 名稱">{m.lineName || "—"}</td>
                  <td data-label="LINE 連結狀態">
                    <span className={`pill ${m.lineBound ? "pill-registered" : "pill-closed"}`}>
                      {m.lineBound ? "已連結" : "未連結"}
                    </span>
                  </td>
                  <td data-label="帳號狀態">
                    <span className={`pill ${m.accountStatus === "啟用" ? "pill-registered" : "pill-closed"}`}>
                      {m.accountStatus || "—"}
                    </span>
                  </td>
                  <td data-label="操作">
                    <div className="cell-actions">
                      <button type="button" className="link-btn" onClick={() => openEdit(m.id)}>編輯</button>
                      <button type="button" className="link-btn" onClick={() => toggleStatus(m)}>
                        {m.accountStatus === "啟用" ? "停用" : "啟用"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="pager-info">共 {total} 筆</span>
        <div className="pager-btns">
          <button type="button" className="btn btn-outline" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            上一頁
          </button>
          <span className="pager-page">第 {page + 1} 頁</span>
          <button type="button" className="btn btn-outline" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
            下一頁
          </button>
        </div>
      </div>

      {edit && (
        <div className="modal-backdrop" onClick={() => !saving && setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">編輯選手資料</div>
            <div className="form-field">
              <label>姓名 *</label>
              <input type="text" value={edit.playerName} onChange={(e) => setEdit({ ...edit, playerName: e.target.value })} />
            </div>
            <div className="form-field">
              <label>聯絡電話 *</label>
              <input type="text" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </div>
            <div className="form-field">
              <label>就讀學校</label>
              <input type="text" value={edit.school} onChange={(e) => setEdit({ ...edit, school: e.target.value })} />
            </div>
            <div className="form-field">
              <label>組別</label>
              <select value={edit.group} onChange={(e) => setEdit({ ...edit, group: e.target.value })}>
                <option value="">請選擇組別</option>
                {GROUP_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setEdit(null)}>取消</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveEdit}>
                {saving ? "儲存中…" : "儲存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
