"use client";

import { useEffect, useState } from "react";
import { btnGray, btnPrimary, btnSoft } from "@/components/line-ui";
import { cache } from "@/lib/member-cache";

export default function SuccessPage() {
  const [info, setInfo] = useState({ name: "—", event: "—", item: "—", bib: "—", photographer: "" });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 瀏覽器儲存只能在掛載後讀
    setInfo({
      name: cache.get("memberName") || "—",
      event: sessionStorage.getItem("lastEvent") || "—",
      item: sessionStorage.getItem("lastItem") || "—",
      bib: sessionStorage.getItem("lastBib") || "—",
      photographer: sessionStorage.getItem("lastPhotographer") || "",
    });
  }, []);

  const rows = [
    ["選手", info.name],
    ["賽事", info.event],
    ["比賽項目", info.item],
    ["選手號碼", info.bib],
    ...(info.photographer ? [["攝影師", info.photographer]] : []),
  ];

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-[360px] rounded-2xl bg-white px-7 py-9 text-center shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
        <div className="mb-3.5 text-[60px]">🎉</div>
        <h1 className="mb-5 text-[22px] font-bold text-brand">報名成功！</h1>
        <div className="mb-6 rounded-[10px] bg-brand-soft p-4 text-left">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between border-b border-[#e3ecf2] py-1.5 text-sm last:border-b-0">
              <span className="text-[#888]">{label}</span>
              <span className="max-w-[60%] text-right font-semibold text-brand-dark">{value}</span>
            </div>
          ))}
        </div>
        <p className="mb-5 text-sm leading-relaxed text-[#666]">報名資料已成功送出，請留意賽事相關通知。</p>
        <a href="/form" className={`${btnPrimary} mt-0 mb-2.5`}>繼續報名其他項目</a>
        <a href="/history" className={`${btnSoft} mt-0 mb-2.5 font-semibold`}>📋 查看所有拍攝紀錄</a>
        <a href="/form" className={`${btnGray} mt-0`}>← 返回</a>
      </div>
    </div>
  );
}
