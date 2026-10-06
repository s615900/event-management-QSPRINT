"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../_lib/api";

interface RegistrationListItem {
  id: string;
  eventName: string;
  date: string;
  time: string;
  group: string;
  school: string;
  playerName: string;
  bibNumber: string;
  itemCategory: string;
  eventItem: string;
  photographer?: string;
}
interface RegistrationDetail extends RegistrationListItem {
  ig: string;
  email: string;
  lineName: string;
  lineUserId: string;
  registrationNumber: string;
  registeredAt: string;
}
interface RegistrationListResponse {
  items: RegistrationListItem[];
  total: number;
  hasMore: boolean;
}
interface LookupResponse {
  items: string[];
}

const GROUP_OPTIONS = ["國中男生", "國中女生", "高中男生", "高中女生", "公開男生", "公開女生"];
const PAGE_SIZE = 20;

type FormFields = {
  eventName: string;
  date: string;
  time: string;
  group: string;
  school: string;
  playerName: string;
  itemCategory: string;
  eventItem: string;
  bibNumber: string;
  ig: string;
  email: string;
};

const emptyForm: FormFields = {
  eventName: "",
  date: "",
  time: "",
  group: "",
  school: "",
  playerName: "",
  itemCategory: "",
  eventItem: "",
  bibNumber: "",
  ig: "",
  email: "",
};

export default function RegistrationsPage() {
  const [items, setItems] = useState<RegistrationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  // 項目分類選項來自 Ragic「比賽項目表」，要和報名表的單選選項一致
  const [itemCategories, setItemCategories] = useState<string[]>([]);

  const [form, setForm] = useState<FormFields | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      q,
      event: eventFilter,
      dateFrom,
      dateTo,
      timeFrom,
      timeTo,
      sort: "datetime",
      order,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    api
      .get<RegistrationListResponse>(`/registrations?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setHasMore(res.hasMore);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [q, eventFilter, dateFrom, dateTo, timeFrom, timeTo, order, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get<LookupResponse>("/lookups/events").then((r) => setEvents(r.items)).catch(() => {});
    api.get<LookupResponse>("/lookups/schools").then((r) => setSchools(r.items)).catch(() => {});
    fetch("/api/event-items")
      .then((r) => r.json())
      .then((groups: Array<{ category: string }>) => setItemCategories(groups.map((g) => g.category)))
      .catch(() => {});
  }, []);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2500);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
  };

  const openEdit = async (id: string) => {
    setError(null);
    try {
      const d = await api.get<RegistrationDetail>(`/registrations/${encodeURIComponent(id)}`);
      setEditId(id);
      setForm({
        eventName: d.eventName,
        date: d.date,
        time: d.time,
        group: d.group,
        school: d.school,
        playerName: d.playerName,
        itemCategory: d.itemCategory,
        eventItem: d.eventItem,
        bibNumber: d.bibNumber,
        ig: d.ig,
        email: d.email,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const save = async () => {
    if (!form) return;
    const required: Array<[keyof FormFields, string]> = [
      ["eventName", "賽事名稱"],
      ["date", "日期"],
      ["time", "時間"],
      ["group", "組別"],
      ["school", "學校"],
      ["playerName", "選手姓名"],
    ];
    const missing = required.filter(([k]) => !form[k]).map(([, label]) => label);
    if (missing.length) {
      setError(`請填寫：${missing.join("、")}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await api.patch(`/registrations/${encodeURIComponent(editId)}`, form);
        flash("已儲存");
      } else {
        await api.post("/registrations", form);
        flash("已新增報名資料");
      }
      setForm(null);
      setEditId(null);
      if (!editId) setPage(0);
      else load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: RegistrationListItem) => {
    if (!window.confirm(`確定要刪除「${item.playerName || "此筆"}」的報名資料嗎？此動作無法復原。`)) return;
    setError(null);
    try {
      await api.del(`/registrations/${encodeURIComponent(item.id)}`);
      flash("已刪除");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const applySearch = () => setPage(0);

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">賽事報名資料</h1>
          <p className="page-sub">搜尋、篩選、編輯與刪除各場賽事的報名紀錄。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>新增報名</button>
      </div>

      <div className="toolbar">
        <input
          className="toolbar-input"
          type="text"
          placeholder="搜尋學校 / 選手姓名"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
        />
        <select className="toolbar-select" value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setPage(0); }}>
          <option value="">全部賽事</option>
          {events.map((ev) => (
            <option key={ev} value={ev}>{ev}</option>
          ))}
        </select>
        <div className="toolbar-range">
          <input
            className="toolbar-input toolbar-date"
            type="date"
            aria-label="日期起"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          />
          <span className="toolbar-range-sep">至</span>
          <input
            className="toolbar-input toolbar-date"
            type="date"
            aria-label="日期迄"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          />
        </div>
        <div className="toolbar-range">
          <input
            className="toolbar-input toolbar-time"
            type="time"
            aria-label="時間起"
            value={timeFrom}
            onChange={(e) => { setTimeFrom(e.target.value); setPage(0); }}
          />
          <span className="toolbar-range-sep">至</span>
          <input
            className="toolbar-input toolbar-time"
            type="time"
            aria-label="時間迄"
            value={timeTo}
            onChange={(e) => { setTimeTo(e.target.value); setPage(0); }}
          />
        </div>
        <button type="button" className="btn btn-outline" onClick={() => { setOrder((o) => (o === "desc" ? "asc" : "desc")); setPage(0); }}>
          日期時間 {order === "desc" ? "↓" : "↑"}
        </button>
        <button type="button" className="btn btn-primary" onClick={applySearch}>搜尋</button>
      </div>

      {msg && <div className="flash-msg">{msg}</div>}
      {error && <div className="error-hint">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>選手</th>
              <th>賽事名稱</th>
              <th>日期 / 時間</th>
              <th>學校 / 組別</th>
              <th>項目</th>
              <th>號碼布</th>
              <th>攝影師</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="table-status">載入中…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={8} className="table-status">查無資料</td></tr>}
            {!loading &&
              items.map((item) => (
                <tr key={item.id}>
                  <td className="cell-title" data-label="選手">{item.playerName || "（未填姓名）"}</td>
                  <td data-label="賽事名稱">{item.eventName || "—"}</td>
                  <td data-label="日期 / 時間">{[item.date.replace(/-/g, "/"), item.time].filter(Boolean).join(" ") || "—"}</td>
                  <td data-label="學校 / 組別">{[item.school, item.group].filter(Boolean).join(" / ") || "—"}</td>
                  <td data-label="項目">{[item.itemCategory, item.eventItem].filter(Boolean).join(" ") || "—"}</td>
                  <td data-label="號碼布">{item.bibNumber || "—"}</td>
                  <td data-label="攝影師">{item.photographer || "不指定"}</td>
                  <td data-label="操作">
                    <div className="cell-actions">
                      <button type="button" className="link-btn" onClick={() => openEdit(item.id)}>編輯</button>
                      <button type="button" className="link-btn danger" onClick={() => remove(item)}>刪除</button>
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
          <button type="button" className="btn btn-outline" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>上一頁</button>
          <span className="pager-page">第 {page + 1} 頁</span>
          <button type="button" className="btn btn-outline" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>下一頁</button>
        </div>
      </div>

      {form && (
        <div className="modal-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editId ? "編輯報名資料" : "新增報名資料"}</div>
            <div className="form-field">
              <label>賽事名稱 *</label>
              {editId ? (
                <input type="text" value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} />
              ) : (
                <select value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })}>
                  <option value="">請選擇賽事</option>
                  {events.map((ev) => (<option key={ev} value={ev}>{ev}</option>))}
                </select>
              )}
            </div>
            <div className="form-field">
              <label>日期 *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-field">
              <label>時間 *</label>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div className="form-field">
              <label>組別 *</label>
              <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
                <option value="">請選擇組別</option>
                {GROUP_OPTIONS.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div className="form-field">
              <label>學校 *</label>
              {editId ? (
                <input type="text" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
              ) : (
                <select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })}>
                  <option value="">請選擇學校</option>
                  {schools.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              )}
            </div>
            <div className="form-field">
              <label>選手姓名 *</label>
              <input type="text" value={form.playerName} onChange={(e) => setForm({ ...form, playerName: e.target.value })} />
            </div>
            <div className="form-field">
              <label>項目分類</label>
              <select value={form.itemCategory} onChange={(e) => setForm({ ...form, itemCategory: e.target.value })}>
                <option value="">請選擇項目分類</option>
                {form.itemCategory && !itemCategories.includes(form.itemCategory) && (
                  <option value={form.itemCategory}>{form.itemCategory}（舊分類）</option>
                )}
                {itemCategories.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="form-field">
              <label>比賽項目</label>
              <input type="text" value={form.eventItem} onChange={(e) => setForm({ ...form, eventItem: e.target.value })} />
            </div>
            <div className="form-field">
              <label>賽事號碼布</label>
              <input type="text" value={form.bibNumber} onChange={(e) => setForm({ ...form, bibNumber: e.target.value })} />
            </div>
            <div className="form-field">
              <label>IG 聯絡資訊</label>
              <input type="text" value={form.ig} onChange={(e) => setForm({ ...form, ig: e.target.value })} />
            </div>
            <div className="form-field">
              <label>E-Mail</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
