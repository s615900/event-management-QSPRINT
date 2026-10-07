"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// 相簿管理（依賽事）：一場賽事＋一位攝影師＝一個雲端資料夾。
// 管理員看所有攝影師；有「相簿權限」的攝影師只看得到自己的（mine）。

interface Album {
  id: string;
  eventName: string;
  photographer: string;
  albumUrl: string;
  isOpen: boolean;
}
interface AlbumRow {
  eventName: string;
  photographer: string;
  athleteCount: number;
  album: Album | null;
}
interface EventSummary {
  eventName: string;
  date: string;
  photographerCount: number;
  openCount: number;
  missingCount: number;
  inMaster: boolean; // 不在賽事資訊總表時無法建立相簿
}
interface Overview {
  events: EventSummary[];
  selected: string | null;
  rows: AlbumRow[];
  fieldReady: boolean;
  mine: string | null;
}

export function AlbumManager({ mine = false }: { mine?: boolean }) {
  const [data, setData] = useState<Overview | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [notify, setNotify] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notifyAll, setNotifyAll] = useState(true);

  const load = useCallback((ev: string) => {
    setError(null);
    api
      .get<Overview>(`/albums${ev ? `?event=${encodeURIComponent(ev)}` : ""}`)
      .then((d) => {
        setData(d);
        setEventName(d.selected ?? "");
        setUrls(Object.fromEntries(d.rows.map((r) => [r.photographer, r.album?.albumUrl ?? ""])));
        setNotify((prev) => Object.fromEntries(d.rows.map((r) => [r.photographer, prev[r.photographer] ?? true])));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 4000);
  };

  const notifyText = (res: { notified: number | null; notifyError: string | null }) =>
    res.notifyError ? `，但 LINE 通知失敗：${res.notifyError}` : res.notified !== null ? `，已用 LINE 通知 ${res.notified} 位選手` : "";

  const save = async (row: AlbumRow, patch: { albumUrl?: string; isOpen?: boolean }) => {
    setBusy(row.photographer);
    setError(null);
    try {
      const res = await api.put<{ album: Album; notified: number | null; notifyError: string | null }>("/albums", {
        eventName: row.eventName,
        photographer: row.photographer,
        ...patch,
        notify: patch.isOpen === true && (notify[row.photographer] ?? true),
      });
      if (patch.isOpen === true) flash(`已開放「${row.photographer}」的相簿${notifyText(res)}`);
      else if (patch.isOpen === false) flash(`已關閉「${row.photographer}」的相簿`);
      else flash("已儲存相簿連結");
      load(row.eventName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: AlbumRow) => {
    if (!row.album || !window.confirm(`確定刪除「${row.photographer}」在這場賽事的相簿連結？`)) return;
    setBusy(row.photographer);
    setError(null);
    try {
      await api.del(`/albums/${encodeURIComponent(row.album.id)}`);
      flash("已刪除相簿連結");
      load(row.eventName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openAll = async () => {
    const ready = data?.rows.filter((r) => r.album?.albumUrl && !r.album.isOpen).length ?? 0;
    if (!ready) {
      setError("這場賽事沒有「已貼連結但還沒開放」的相簿");
      return;
    }
    if (!window.confirm(`要開放這場賽事 ${ready} 本相簿${notifyAll ? "，並用 LINE 通知選手" : ""}嗎？`)) return;
    setBusy("__all__");
    setError(null);
    try {
      const res = await api.post<{ opened: number; notified: number; notifyError: string | null }>("/albums/open-all", {
        eventName,
        notify: notifyAll,
      });
      flash(`已開放 ${res.opened} 本相簿${notifyText({ notified: notifyAll ? res.notified : null, notifyError: res.notifyError })}`);
      load(eventName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const current = data?.events.find((e) => e.eventName === eventName);

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">{mine ? "我的相簿" : "相簿管理"}</h1>
          <p className="page-sub">
            一場賽事＋一位攝影師＝一個雲端資料夾。開放後，選了這位攝影師的選手在 LINE「賽事相簿」就看得到。
          </p>
        </div>
      </div>

      {data && !data.fieldReady && (
        <div className="error-hint" style={{ padding: "12px 0", textAlign: "left" }}>
          ⚠️ Ragic「賽事相簿連結」表還沒有「攝影師」欄位，新增後才能儲存相簿。
        </div>
      )}
      {msg && <div className="flash-msg">{msg}</div>}
      {error && <div className="error-hint" style={{ padding: "12px 0" }}>{error}</div>}
      {!data && !error && <div className="loading-hint">載入中…</div>}

      {data && data.events.length === 0 && (
        <div className="staff-list">
          <div className="staff-empty">
            {mine ? "還沒有選手在報名時選你，有人選了之後會出現在這裡" : "還沒有選手在報名時選攝影師"}
          </div>
        </div>
      )}

      {data && data.events.length > 0 && (
        <>
          <div className="toolbar">
            <select className="toolbar-select" style={{ flex: 1, minWidth: 240 }} value={eventName} onChange={(e) => load(e.target.value)}>
              {data.events.map((ev) => (
                <option key={ev.eventName} value={ev.eventName}>
                  {ev.eventName}
                  {!ev.inMaster ? "（不在賽事資訊總表）" : ev.missingCount ? `（缺 ${ev.missingCount} 本）` : ""}
                </option>
              ))}
            </select>
            {!mine && (
              <>
                <label className="staff-active-label">
                  <input type="checkbox" checked={notifyAll} onChange={(e) => setNotifyAll(e.target.checked)} />
                  同時 LINE 通知選手
                </label>
                <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={openAll}>
                  全部開放
                </button>
              </>
            )}
          </div>

          {current && !current.inMaster && (
            <div className="error-hint" style={{ padding: "4px 0 12px", textAlign: "left" }}>
              ⚠️「{current.eventName}」不在 Ragic「賽事資訊總表」裡，相簿無法存入。請先到賽事資訊總表新增這個賽事名稱（要一字不差），
              或請管理員把這些報名的賽事名稱改成總表裡的名稱。
            </div>
          )}
          {current && (
            <p className="page-sub" style={{ marginBottom: 12 }}>
              {current.date && `${current.date}・`}攝影師 {current.photographerCount} 位・已開放 {current.openCount} 本
              {current.missingCount > 0 && `・還沒貼連結 ${current.missingCount} 本`}
            </p>
          )}

          <div className="staff-list">
            {data.rows.map((row) => {
              const status = !row.album?.albumUrl ? "尚未建立" : row.album.isOpen ? "已開放" : "未開放";
              const pill = status === "已開放" ? "pill-registered" : status === "未開放" ? "pill-pending" : "pill-closed";
              const url = urls[row.photographer] ?? "";
              const dirty = url.trim() !== (row.album?.albumUrl ?? "");
              const locked = !!current && !current.inMaster;
              const isBusy = busy === row.photographer || busy === "__all__" || locked;
              return (
                <div className="staff-row" key={row.photographer}>
                  <div className="staff-avatar">{row.photographer.charAt(0)}</div>
                  <div className="staff-main" style={{ minWidth: 260 }}>
                    <div className="staff-name-line">
                      <span className="staff-name" style={{ cursor: "default" }}>{row.photographer}</span>
                      <span className={`pill ${pill}`}>{status}</span>
                      <span className="page-sub" style={{ margin: 0 }}>{row.athleteCount} 筆報名選了這位攝影師</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <input
                        className="toolbar-input"
                        style={{ flex: 1, minWidth: 220 }}
                        type="url"
                        placeholder="貼上 Google 雲端資料夾連結 https://drive.google.com/..."
                        value={url}
                        disabled={locked}
                        onChange={(e) => setUrls({ ...urls, [row.photographer]: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={isBusy || !dirty}
                        onClick={() => save(row, { albumUrl: url.trim() })}
                      >
                        儲存連結
                      </button>
                      {row.album?.albumUrl && (
                        <a className="btn btn-outline" href={row.album.albumUrl} target="_blank" rel="noopener noreferrer">
                          開啟
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="staff-actions" style={{ flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <label className="staff-active-label">
                      <span className="switch">
                        <input
                          type="checkbox"
                          checked={!!row.album?.isOpen}
                          disabled={isBusy || !row.album?.albumUrl || dirty}
                          onChange={(e) => save(row, { isOpen: e.target.checked })}
                        />
                        <span className="slider" />
                      </span>
                      {row.album?.isOpen ? "已開放" : "開放相簿"}
                    </label>
                    {!row.album?.isOpen && (
                      <label className="staff-active-label">
                        <input
                          type="checkbox"
                          checked={notify[row.photographer] ?? true}
                          onChange={(e) => setNotify({ ...notify, [row.photographer]: e.target.checked })}
                        />
                        開放時 LINE 通知選手
                      </label>
                    )}
                    {row.album && (
                      <button type="button" className="link-btn danger" disabled={isBusy} onClick={() => remove(row)}>
                        刪除連結
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="page-sub" style={{ marginTop: 12 }}>
            提醒：Google 雲端資料夾的分享權限要設成「知道連結的任何人都可以檢視」，選手才打得開。先貼連結並儲存，才能開放。
          </p>
        </>
      )}
    </main>
  );
}
