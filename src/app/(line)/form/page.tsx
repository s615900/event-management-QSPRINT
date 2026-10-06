"use client";

import { useEffect, useState } from "react";
import { V1Header } from "@/components/v1-ui";
import { AccountDisabled, btnPrimary, btnSoft, Card, Container, Field, inputCls, Loading } from "@/components/line-ui";
import { authHeaders, getLineIdToken } from "@/lib/liff";
import { cache, readCachedMember, saveMember, type MemberInfo } from "@/lib/member-cache";

type EventOption = { id: string; name: string; startDate: string; endDate: string };
type PhotographerOption = { id: number; name: string };

// 攝影師選單的「不指定」選項
const NO_PREFERENCE = "none";

const ITEMS: Record<string, string[]> = {
  田賽: ["跳高", "撐竿跳高", "跳遠", "三級跳遠", "鉛球", "鐵餅", "標槍", "鏈球"],
  徑賽: [
    "100公尺", "200公尺", "400公尺", "800公尺", "1500公尺", "3000公尺", "5000公尺", "10000公尺",
    "110公尺跨欄", "100公尺跨欄", "400公尺跨欄", "3000公尺障礙", "4x100公尺接力", "4x400公尺接力",
  ],
  混合賽: ["十項全能", "七項全能"],
};

type Fields = { eventName: string; bibNumber: string; eventDate: string; eventTime: string; itemCategory: string; eventItem: string };
const ERR: Record<keyof Fields, string> = {
  eventName: "請選擇賽事",
  bibNumber: "請填寫選手號碼",
  eventDate: "請選擇日期",
  eventTime: "請選擇時間",
  itemCategory: "請選擇項目分類",
  eventItem: "請選擇比賽項目",
};

export default function FormPage() {
  const [stage, setStage] = useState<"loading" | "ready" | "disabled">("loading");
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [events, setEvents] = useState<EventOption[] | null>(null);
  const [eventsError, setEventsError] = useState(false);
  const [photographers, setPhotographers] = useState<PhotographerOption[]>([]);
  const [photographerId, setPhotographerId] = useState("");
  const [photographerError, setPhotographerError] = useState("");
  const [idToken, setIdToken] = useState("");
  const [f, setF] = useState<Fields>({ eventName: "", bibNumber: "", eventDate: "", eventTime: "", itemCategory: "", eventItem: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [submitText, setSubmitText] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // 先用快取立即顯示（避免空白）
      setMember(readCachedMember());

      // 每次開頁即時從 Ragic 取最新資料，避免後台更新後仍顯示舊值
      const lineUserId = cache.get("lineUserId");
      if (lineUserId) {
        const token = await getLineIdToken();
        setIdToken(token);
        try {
          const mres = await fetch(`/api/member/${encodeURIComponent(lineUserId)}`, { headers: authHeaders(token) });
          const mdata = await mres.json();
          if (mdata.found && mdata.member.accountStatus === "停用") {
            setStage("disabled");
            return;
          }
          if (mdata.found) {
            saveMember(mdata.member);
            setMember(mdata.member);
          } else {
            // 查無此人的會員記錄（例如 localStorage 殘留未成功寫入的舊狀態）→ 導回登錄頁重新建檔
            localStorage.removeItem("isMember");
            window.location.href = "/register";
            return;
          }
        } catch {
          /* 查詢失敗時保持快取顯示，不中斷頁面 */
        }
      }

      // 載入賽事（只顯示開放報名的）與可挑選的攝影師
      const [eventsRes, photographersRes] = await Promise.allSettled([
        fetch("/api/events").then((r) => r.json()),
        fetch("/api/photographers").then((r) => r.json()),
      ]);
      if (eventsRes.status === "fulfilled") setEvents(Array.isArray(eventsRes.value) ? eventsRes.value : []);
      else setEventsError(true);
      // 攝影師名單讀不到時就不顯示這個欄位，不擋住報名
      if (photographersRes.status === "fulfilled" && Array.isArray(photographersRes.value)) {
        setPhotographers(photographersRes.value);
      }
      setStage("ready");
    }
    init();
  }, []);

  const ev = events?.find((e) => e.name === f.eventName);
  const hasRange = !!(ev && ev.startDate && ev.endDate);

  function onEventChange(name: string) {
    const next = events?.find((e) => e.name === name);
    setF((prev) => {
      let eventDate = prev.eventDate;
      // 依所選賽事限制可選日期區間；預設帶入開始日期，超出範圍則夾回範圍內
      if (next?.startDate && next.endDate && (!eventDate || eventDate < next.startDate || eventDate > next.endDate)) {
        eventDate = next.startDate;
      }
      return { ...prev, eventName: name, bibNumber: name ? prev.bibNumber : "", eventDate };
    });
  }

  function validate() {
    const errs: Partial<Record<keyof Fields, string>> = {};
    (Object.keys(ERR) as (keyof Fields)[]).forEach((k) => {
      if (!f[k].trim()) errs[k] = ERR[k];
    });
    // 日期需落在所選賽事的區間內
    if (ev && f.eventDate && hasRange && (f.eventDate < ev.startDate || f.eventDate > ev.endDate)) {
      errs.eventDate = `日期需在 ${ev.startDate} ～ ${ev.endDate} 之間`;
    }
    setErrors(errs);
    // 有攝影師可挑時必須選一個（可以選「不指定」）
    const needPhotographer = photographers.length > 0 && !photographerId;
    setPhotographerError(needPhotographer ? "請選擇攝影師" : "");
    return Object.keys(errs).length === 0 && !needPhotographer;
  }

  async function submit() {
    if (!validate()) return;
    setSubmitText("確認會員資料中...");

    // 送出前以伺服器查詢結果為準，確認真的有這個 LINE userId 的會員記錄
    const lineUserId = cache.get("lineUserId");
    let token = idToken;
    if (!token) {
      token = await getLineIdToken();
      setIdToken(token);
    }
    try {
      const checkRes = await fetch(`/api/member/${encodeURIComponent(lineUserId)}`, { headers: authHeaders(token) });
      const checkData = await checkRes.json();
      if (!checkData.found) {
        alert("尚未完成選手登錄，請重新登錄後再報名。");
        localStorage.removeItem("isMember");
        window.location.href = "/register";
        return;
      }
    } catch {
      alert("網路錯誤，請再試一次");
      setSubmitText(null);
      return;
    }

    setSubmitText("送出中...");
    const bibNumber = f.bibNumber.trim();
    const payload = {
      lineUserId,
      lineName: cache.get("lineName"),
      playerName: cache.get("memberName"),
      group: cache.get("memberGroup"),
      school: cache.get("memberSchool"),
      email: cache.get("memberEmail"),
      ig: cache.get("memberIG"),
      eventName: f.eventName,
      bibNumber,
      date: f.eventDate,
      time: f.eventTime,
      itemCategory: f.itemCategory,
      eventItem: f.eventItem,
      pictureUrl: cache.get("linePicture"),
      photographerId: photographerId === NO_PREFERENCE ? "" : photographerId,
    };
    const photographerName = photographers.find((p) => String(p.id) === photographerId)?.name ?? "不指定";
    sessionStorage.setItem("lastEvent", f.eventName);
    sessionStorage.setItem("lastBib", bibNumber);
    sessionStorage.setItem("lastItem", f.eventItem);
    sessionStorage.setItem("lastPhotographer", photographers.length > 0 ? photographerName : "");

    try {
      const res = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/success";
      } else {
        alert(data.error || "送出失敗，請再試一次");
        setSubmitText(null);
      }
    } catch {
      alert("網路錯誤，請再試一次");
      setSubmitText(null);
    }
  }

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <>
      <V1Header title="🏅 賽事拍攝登記" subtitle="請選擇要報名的賽事與項目" back />
      <Container>
        {stage === "loading" && <Loading text="載入賽事資料中..." />}
        {stage === "disabled" && <AccountDisabled />}
        {stage === "ready" && (
          <div>
            <Card>
              <div className="rounded-lg border border-brand-line bg-brand-soft px-3.5 py-3 text-sm leading-[1.8] text-brand-dark">
                <p>選手：<b>{member?.playerName || "—"}</b></p>
                <p>組別：<b>{member?.group || "—"}</b>　學校：<b>{member?.school || "—"}</b></p>
                <p>電話：<b>{member?.phone || "—"}</b></p>
                <p>IG：<b>{member?.ig || "—"}</b></p>
                <p>E-Mail：<b>{member?.email || "—"}</b></p>
                <p className="mt-2 border-t border-dashed border-brand-line pt-2 text-xs text-[#8a6d1b]">
                  🔒 個人資料已鎖定，如需修改請聯絡管理員
                </p>
              </div>
            </Card>

            <Card>
              <Field label="賽事名稱" required error={errors.eventName}>
                <select className={inputCls} value={f.eventName} onChange={(e) => onEventChange(e.target.value)}>
                  {eventsError ? (
                    <option value="">載入失敗，請重新整理</option>
                  ) : events && events.length === 0 ? (
                    <option value="">目前無開放報名的賽事</option>
                  ) : (
                    <option value="">請選擇賽事</option>
                  )}
                  {events?.map((e) => (
                    <option key={e.id} value={e.name}>
                      {e.name + (e.startDate ? `（${e.startDate}）` : "")}
                    </option>
                  ))}
                </select>
              </Field>

              {/* 選手號碼（選完賽事後顯示） */}
              {f.eventName && (
                <div className="mt-1 border-t border-[#f0f0f0] pt-4">
                  <Field label="選手號碼" required error={errors.bibNumber}>
                    <input className={inputCls} value={f.bibNumber} onChange={set("bibNumber")} placeholder="請輸入您的選手號碼" inputMode="numeric" />
                    <div className="mt-[5px] text-xs text-[#888]">📋 請依號碼簿填入您的號碼</div>
                  </Field>
                </div>
              )}

              <div className="mb-4 flex gap-2.5">
                <Field label="比賽日期" required error={errors.eventDate} className="mb-0! flex-1">
                  <input
                    type="date"
                    className={inputCls}
                    value={f.eventDate}
                    min={hasRange ? ev!.startDate : undefined}
                    max={hasRange ? ev!.endDate : undefined}
                    onChange={set("eventDate")}
                  />
                  {hasRange && <div className="mt-[5px] text-xs text-[#888]">僅可選擇 {ev!.startDate} ～ {ev!.endDate}</div>}
                </Field>
                <Field label="比賽時間" required error={errors.eventTime} className="mb-0! flex-1">
                  <input type="time" className={inputCls} value={f.eventTime} onChange={set("eventTime")} />
                </Field>
              </div>

              <Field label="項目分類" required error={errors.itemCategory}>
                <select
                  className={inputCls}
                  value={f.itemCategory}
                  onChange={(e) => setF((prev) => ({ ...prev, itemCategory: e.target.value, eventItem: "" }))}
                >
                  <option value="">請選擇項目分類</option>
                  {Object.keys(ITEMS).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="比賽項目" required error={errors.eventItem}>
                <select className={inputCls} value={f.eventItem} onChange={set("eventItem")}>
                  <option value="">{f.itemCategory ? "請選擇比賽項目" : "請先選擇項目分類"}</option>
                  {(ITEMS[f.itemCategory] ?? []).map((it) => <option key={it} value={it}>{it}</option>)}
                </select>
              </Field>

              {photographers.length > 0 && (
                <Field label="攝影師" required error={photographerError}>
                  <select className={inputCls} value={photographerId} onChange={(e) => setPhotographerId(e.target.value)}>
                    <option value="">請選擇攝影師</option>
                    {photographers.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    <option value={NO_PREFERENCE}>不指定（由工作人員安排）</option>
                  </select>
                </Field>
              )}
            </Card>

            <button className={btnPrimary} disabled={!!submitText} onClick={submit}>
              {submitText ?? "確認報名"}
            </button>
            <a href="/history" className={`${btnSoft} text-center`}>📋 查看賽事拍攝紀錄</a>
          </div>
        )}
      </Container>
    </>
  );
}
