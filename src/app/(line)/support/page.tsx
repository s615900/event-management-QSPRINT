"use client";

import { useEffect, useState } from "react";
import { V1Container, V1Header } from "@/components/v1-ui";
import { authHeaders, fetchMember, getLineIdToken } from "@/lib/liff";
import { cache, readCachedMember, saveMember } from "@/lib/member-cache";

// 贊助頁：銀行轉帳資訊＋轉帳回報表單（回報資料送到 /api/sponsor，存進 Ragic，後台「贊助清單」可看）
const BANK = {
  name: "012 台北富邦銀行",
  holder: "吳偉德",
  account: "00749168304340",
};

const inputCls =
  "mb-3.5 w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/40";
const labelCls = "mb-1 block text-[13px] text-gray-500";
const btnCls =
  "w-full rounded-[10px] bg-brand py-3 text-[15px] font-bold text-white active:scale-[0.98] disabled:opacity-60";

// 聯絡方式：IG 優先，其次手機、Email
function pickContact(m: { ig?: string; phone?: string; email?: string }) {
  return m.ig || m.phone || m.email || "";
}

export default function SupportPage() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [amount, setAmount] = useState("");
  const [last5, setLast5] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // 帶入選手資料：先用手機快取，再向後端取最新（只在欄位還沒被使用者改過時覆蓋）
  useEffect(() => {
    const cached = readCachedMember();
    setName((v) => v || cached.playerName || "");
    setContact((v) => v || pickContact(cached));

    (async () => {
      const lineUserId = cache.get("lineUserId");
      if (!lineUserId) return;
      try {
        const token = await getLineIdToken();
        const data = await fetchMember(lineUserId, token);
        if (data.found && data.member) {
          saveMember(data.member);
          setName((v) => v || data.member?.playerName || "");
          setContact((v) => v || pickContact(data.member ?? {}));
        }
      } catch {
        // 取不到就維持手動填寫
      }
    })();
  }, []);

  async function copyAccount() {
    const text = BANK.account.replace(/[^0-9]/g, "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: name.trim(),
      amount: amount.replace(/[^0-9]/g, ""),
      last5: last5.replace(/[^0-9]/g, ""),
      date,
      contact: contact.trim(),
      note: note.trim(),
    };
    if (!data.name || !data.amount || !data.contact) return setMsg({ text: "請填寫名字、金額和聯絡方式", ok: false });
    if (data.last5.length !== 5) return setMsg({ text: "帳號末五碼請填 5 位數字", ok: false });

    setSending(true);
    try {
      const token = await getLineIdToken();
      const res = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "送出失敗");
      setAmount("");
      setLast5("");
      setDate("");
      setNote("");
      setMsg({ text: "收到了！謝謝你的支持 🧡 我們對完帳會再跟你說聲謝謝。", ok: true });
    } catch (err) {
      setMsg({ text: `${(err as Error).message || "送出失敗"}，請稍後再試，或直接私訊我們。`, ok: false });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <V1Header title="☕ 支持 QSPRINT" subtitle="支持我們持續記錄賽場" back />
      <V1Container>
        <p className="mb-5 text-center text-sm leading-7 text-gray-500">
          QSPRINT 的賽事攝影與紀錄都是自費完成的。
          <br />
          如果這些照片曾經讓你停下來多看一眼，歡迎請我們喝杯咖啡，金額不拘，每一份支持都會變成下一場比賽的動力。
        </p>

        <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-brand">STEP 1</span>
          <p className="text-[17px] font-bold text-gray-900">銀行轉帳</p>
          <p className="mb-4 text-[13px] text-gray-500">網路銀行、ATM 皆可</p>
          <dl className="mb-4 text-[15px] leading-8">
            <dt className="text-[13px] text-gray-500">銀行</dt>
            <dd className="font-semibold">{BANK.name}</dd>
            <dt className="text-[13px] text-gray-500">戶名</dt>
            <dd className="font-semibold">{BANK.holder}</dd>
            <dt className="text-[13px] text-gray-500">帳號</dt>
            <dd className="break-all font-semibold tabular-nums">{BANK.account}</dd>
          </dl>
          <button type="button" onClick={copyAccount} className={btnCls}>
            {copied ? "已複製 ✓" : "複製帳號"}
          </button>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-brand">STEP 2</span>
          <p className="text-[17px] font-bold text-gray-900">轉帳回報</p>
          <p className="mb-4 text-[13px] leading-6 text-gray-500">轉帳完成後填一下，我們才知道是你，才能好好謝謝你 🙏</p>
          <form onSubmit={onSubmit} noValidate>
            <label htmlFor="s-name" className={labelCls}>
              選手名稱／暱稱 <span className="text-brand">*</span>
            </label>
            <input id="s-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="s-amount" className={labelCls}>
                  金額 <span className="text-brand">*</span>
                </label>
                <input id="s-amount" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="例：300" />
              </div>
              <div>
                <label htmlFor="s-last5" className={labelCls}>
                  帳號末五碼 <span className="text-brand">*</span>
                </label>
                <input id="s-last5" className={inputCls} value={last5} onChange={(e) => setLast5(e.target.value)} inputMode="numeric" maxLength={5} placeholder="12345" />
              </div>
            </div>

            <label htmlFor="s-date" className={labelCls}>轉帳日期</label>
            <input id="s-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />

            <label htmlFor="s-contact" className={labelCls}>聯絡方式（IG／手機／Email） <span className="text-brand">*</span>
            </label>
            <input id="s-contact" className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={80} />

            <label htmlFor="s-note" className={labelCls}>想說的話（選填）</label>
            <textarea id="s-note" className={`${inputCls} min-h-[72px] resize-y`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />

            <button type="submit" disabled={sending} className={btnCls}>
              {sending ? "送出中…" : "送出回報"}
            </button>
            {msg && <p className={`mt-3 text-center text-sm leading-6 ${msg.ok ? "text-gray-700" : "text-danger"}`}>{msg.text}</p>}
          </form>
        </section>
      </V1Container>
    </>
  );
}
