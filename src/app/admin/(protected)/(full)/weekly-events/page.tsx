"use client";

import { useEffect, useState } from "react";
import { api } from "../../_lib/api";

interface RegisteredPlayer {
  playerName: string;
  time: string;
  itemCategory: string;
  eventItem: string;
  bibNumber: string;
  school: string;
}
interface WeeklyEventCard {
  eventName: string;
  albumOpen: boolean;
  players: RegisteredPlayer[];
}
interface WeeklyDay {
  date: string;
  weekday: number;
  events: WeeklyEventCard[];
}
interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  offset: number;
  isCurrentWeek: boolean;
  todayTaipei: string;
  days: WeeklyDay[];
}

const WEEKDAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export default function WeeklyEventsPage() {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<WeeklyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<WeeklyData>(`/weekly-events?offset=${offset}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset]);

  return (
    <main className="main">
      <div className="header-row">
        <div>
          <h1 className="page-title">本週賽事</h1>
          <p className="page-sub">依週檢視各檔期的賽事、報名人數與相簿開放狀態。</p>
        </div>
      </div>

      <div className="week-nav">
        <button type="button" className="btn btn-outline" onClick={() => setOffset((o) => o - 1)} disabled={loading}>
          ← 上一週
        </button>
        <div className="week-nav-label">
          {data ? (
            <>
              <div className="week-nav-range">
                {data.weekStart} ～ {data.weekEnd}
              </div>
              <div className="week-nav-sub">
                {data.isCurrentWeek ? "本週" : data.offset < 0 ? "過去週次" : "未來週次"}
              </div>
            </>
          ) : (
            <div className="week-nav-range">—</div>
          )}
        </div>
        <button type="button" className="btn btn-outline" onClick={() => setOffset((o) => o + 1)} disabled={loading}>
          下一週 →
        </button>
      </div>

      {error && <div className="error-hint">載入失敗：{error}</div>}
      {!error && !data && <div className="loading-hint">載入中…</div>}

      {data && (
        <div className="week-grid">
          {data.days.map((day) => {
            const isToday = day.date === data.todayTaipei;
            return (
              <div className={`week-day${isToday ? " week-day-today" : ""}`} key={day.date}>
                <div className="week-day-head">
                  <span className="week-day-weekday">{WEEKDAY_LABELS[day.weekday]}</span>
                  <span className="week-day-date">{day.date.slice(5)}</span>
                </div>
                {day.events.length === 0 ? (
                  <div className="week-day-empty">無賽事</div>
                ) : (
                  day.events.map((ev, i) => (
                    <div className="week-event-card" key={i}>
                      <div className="week-event-name">{ev.eventName}</div>
                      <span className={`badge${ev.albumOpen ? " badge-on" : ""}`}>
                        {ev.albumOpen ? "相簿已開放" : "相簿未開放"}
                      </span>
                      <div className="week-player-list">
                        {ev.players.map((p, j) => (
                          <div className="week-player-row" key={j}>
                            <div className="week-player-line">
                              <span className="week-player-time">{p.time || "—"}</span>
                              <span className="week-player-name">{p.playerName || "（未填姓名）"}</span>
                            </div>
                            <div className="week-player-line week-player-line-sub">
                              <span className="week-player-school">{p.school || "—"}</span>
                              <span className="week-player-item">
                                {[p.itemCategory, p.eventItem].filter(Boolean).join(" ") || "—"}
                              </span>
                              <span className="week-player-bib">#{p.bibNumber || "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
