"use client";

import { useEffect, useState } from "react";
import { V1Header } from "@/components/v1-ui";
import { AccountDisabled, btnGray, btnPrimary, Container, Spinner } from "@/components/line-ui";
import { authHeaders, getLineIdToken } from "@/lib/liff";
import { cache, saveMember } from "@/lib/member-cache";

type RecordItem = {
  id: string;
  eventName: string;
  date: string;
  time: string;
  itemCategory: string;
  eventItem: string;
  bibNumber: string;
  group: string;
  school: string;
  photographer?: string;
};

export default function HistoryPage() {
  const [name, setName] = useState("—");
  const [stage, setStage] = useState<"loading" | "list" | "empty" | "disabled">("loading");
  const [records, setRecords] = useState<RecordItem[]>([]);

  useEffect(() => {
    async function init() {
      setName(cache.get("memberName") || "—");
      const lineUserId = cache.get("lineUserId");
      if (!lineUserId) {
        setStage("empty");
        return;
      }
      const headers = authHeaders(await getLineIdToken());

      // 即時向 Ragic 取最新選手資料，更新頁首與側邊抽屜
      try {
        const mres = await fetch(`/api/member/${encodeURIComponent(lineUserId)}`, { headers });
        const mdata = await mres.json();
        if (mdata.found && mdata.member.accountStatus === "停用") {
          setStage("disabled");
          return;
        }
        if (mdata.found) {
          saveMember(mdata.member);
          setName(mdata.member.playerName || "—");
        }
      } catch {
        /* 查詢失敗時保持快取 */
      }

      try {
        const res = await fetch(`/api/registrations/${encodeURIComponent(lineUserId)}`, { headers });
        const list = await res.json();
        if (!Array.isArray(list) || list.length === 0) {
          setStage("empty");
          return;
        }
        setRecords(list);
        setStage("list");
      } catch {
        setStage("empty");
      }
    }
    init();
  }, []);

  return (
    <>
      <V1Header title="📋 賽事拍攝紀錄" subtitle="查詢您的所有賽事拍攝登記" back />
      <Container>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-white px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <p className="text-sm text-[#333]">
            選手：<span className="font-semibold text-brand">{name}</span>
          </p>
          {stage === "list" && <span className="text-[13px] text-[#888]">共 {records.length} 筆</span>}
        </div>

        {stage === "loading" && (
          <div className="px-5 py-[60px] text-center text-[#888]">
            <Spinner size={36} />
            <p>查詢中...</p>
          </div>
        )}
        {stage === "disabled" && <AccountDisabled />}
        {stage === "empty" && (
          <div className="px-5 py-[60px] text-center">
            <div className="mb-3 text-5xl">🏁</div>
            <p className="text-[15px] text-[#888]">目前尚無報名記錄</p>
          </div>
        )}

        {stage === "list" &&
          records.map((r) => (
            <div key={r.id} className="mb-3 rounded-xl border-l-4 border-brand bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
              <div className="mb-2.5 text-base font-semibold text-[#222]">🏆 {r.eventName || "—"}</div>
              {[
                ["比賽項目", `${r.itemCategory || ""}・${r.eventItem || "—"}`],
                ["組別", r.group || "—"],
                ["日期時間", `${r.date || "—"} ${r.time || ""}`],
                ["學校", r.school || "—"],
                ["攝影師", r.photographer || "不指定"],
              ].map(([label, value]) => (
                <div key={label} className="mb-1 flex items-center text-sm">
                  <span className="w-[70px] shrink-0 text-[#999]">{label}</span>
                  <span className="text-[#333]">{value}</span>
                </div>
              ))}
              <span className="mt-2 inline-block rounded-full border border-brand-line bg-brand-soft px-3 py-[3px] text-[13px] font-semibold text-brand-dark">
                號碼 {r.bibNumber || "—"}
              </span>
            </div>
          ))}

        {stage !== "disabled" && (
          <>
            <a href="/form" className={`${btnPrimary} p-[13px] text-center text-[15px]`}>+ 繼續報名</a>
            <a href="/form" className={`${btnGray} text-center`}>← 返回</a>
          </>
        )}
      </Container>
    </>
  );
}
