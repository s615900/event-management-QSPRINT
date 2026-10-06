"use client";

import { useEffect, useState } from "react";
import { V1Header } from "@/components/v1-ui";
import { Container, inputCls, Spinner } from "@/components/line-ui";
import { authHeaders, getLiff, isPreviewMode } from "@/lib/liff";
import { cache } from "@/lib/member-cache";

type Album = { eventName: string; school: string; status: string; albumUrl: string };

const btnAlbum =
  "mt-3.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] border-none bg-brand p-3 text-[15px] font-semibold text-white active:bg-brand-dark";

export default function AlbumPage() {
  const [stage, setStage] = useState<"loading" | "main" | "error" | "disabled">("loading");
  const [loadingText, setLoadingText] = useState("LINE 驗證中...");
  const [error, setError] = useState({ msg: "發生錯誤，請稍後再試。", detail: "" });
  const [albums, setAlbums] = useState<Album[]>([]);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<Album | null>(null);

  useEffect(() => {
    async function init() {
      const fail = (msg: string, detail: string) => {
        setError({ msg, detail });
        setStage("error");
      };
      let liff;
      try {
        liff = await getLiff();
      } catch (e) {
        return fail("LIFF 初始化失敗", (e as Error).message || String(e));
      }

      let idToken = "";
      let lineUserId: string;
      if (isPreviewMode()) {
        lineUserId = cache.get("lineUserId") || "preview_user_001";
      } else {
        if (!liff.isInClient() && !liff.isLoggedIn()) {
          liff.login({ redirectUri: location.href });
          return;
        }
        try {
          lineUserId = (await liff.getProfile()).userId;
          idToken = liff.getIDToken() || "";
        } catch (e) {
          return fail("無法取得 LINE 帳號資訊", (e as Error).message || String(e));
        }
      }
      const headers = authHeaders(idToken);

      setLoadingText("確認帳號狀態...");
      try {
        const mres = await fetch(`/api/member/${encodeURIComponent(lineUserId)}`, { headers });
        const mdata = await mres.json();
        if (mdata.found && mdata.member.accountStatus === "停用") {
          setStage("disabled");
          return;
        }
      } catch {
        /* 查詢失敗時忽略，避免因防護檢查失敗卡住正常使用者 */
      }

      setLoadingText("讀取相簿資料...");
      try {
        const res = await fetch("/api/album/my", { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setAlbums(data.albums || []);
      } catch (e) {
        return fail("讀取相簿清單失敗", (e as Error).message || String(e));
      }
      setStage("main");
    }
    init();
  }, []);

  async function goToAlbum() {
    if (!pending) return;
    const url = pending.albumUrl;
    setPending(null);
    try {
      const liff = await getLiff();
      if (liff.isInClient()) {
        liff.openWindow({ url, external: true });
        return;
      }
    } catch {}
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const kw = q.trim().toLowerCase();
  const list = kw
    ? albums.filter((a) => a.eventName.toLowerCase().includes(kw) || a.school.toLowerCase().includes(kw))
    : albums;

  return (
    <>
      <V1Header title="📂 賽事相簿" subtitle="查看您參加的賽事相簿資料夾" back />
      <Container>
        {stage === "loading" && (
          <div className="px-5 py-10 text-center text-[#666]">
            <Spinner size={36} />
            <p className="text-[15px] leading-relaxed">{loadingText}</p>
          </div>
        )}
        {stage === "error" && (
          <div className="px-5 py-10 text-center text-[#666]">
            <p className="text-[15px]">😕</p>
            <p className="text-[15px] leading-relaxed">{error.msg}</p>
            <p className="mt-1.5 text-[13px] text-[#999]">{error.detail}</p>
          </div>
        )}
        {stage === "disabled" && (
          <div className="px-5 py-10 text-center text-[#666]">
            <p>⚠️ 帳號已停用</p>
            <a href="/register" className={btnAlbum}>重新登錄</a>
          </div>
        )}
        {stage === "main" && (
          <div>
            <div className="mb-3.5">
              <input type="search" className={inputCls} placeholder="搜尋賽事名稱或學校..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {list.length === 0 ? (
              <div className="px-5 py-10 text-center text-[#666]">
                <div className="mb-3 text-5xl">{kw ? "🔍" : "📂"}</div>
                <p className="text-[15px]">{kw ? "找不到符合的賽事" : "目前尚無相簿資料"}</p>
                <p className="mt-1.5 text-[13px] text-[#999]">{kw ? "請試試其他關鍵字" : "您的相簿準備好後會顯示在這裡"}</p>
              </div>
            ) : (
              list.map((a) => {
                const isPublic = a.status === "已公開" && a.albumUrl;
                return (
                  <div key={`${a.eventName}-${a.school}`} className="mb-3 rounded-xl bg-white px-[18px] py-4 shadow-[0_1px_4px_rgba(0,0,0,.08)]">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="break-all text-[15px] font-semibold leading-snug text-[#222]">{a.eventName}</div>
                        <div className="mt-1 text-[13px] text-[#666]">🏫 {a.school}</div>
                      </div>
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isPublic ? "bg-brand-soft text-brand-dark" : "bg-[#f5f5f5] text-[#888]"
                        }`}
                      >
                        {isPublic ? "已公開" : "準備中"}
                      </span>
                    </div>
                    {isPublic ? (
                      <button className={btnAlbum} onClick={() => setPending(a)}>
                        <span>📂</span> 進入相簿資料夾
                      </button>
                    ) : (
                      <p className="mt-3 text-center text-xs text-[#aaa]">相簿資料夾準備中，公開後將顯示於此</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </Container>

      {/* 跳轉至 Google 雲端硬碟前的確認提示 */}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45">
          <div className="w-[90%] max-w-[320px] rounded-[14px] bg-white px-6 py-7 text-center">
            <div className="mb-2.5 text-[40px]">📂</div>
            <h2 className="mb-2 text-base font-semibold text-[#222]">{pending.eventName}</h2>
            <p className="text-[13px] leading-relaxed text-[#666]">即將跳轉至 Google 雲端硬碟相簿資料夾，確認後開啟。</p>
            <div className="mt-[18px] flex gap-2.5">
              <button className="flex-1 rounded-lg bg-[#f0f0f0] p-[11px] text-sm font-semibold text-[#555]" onClick={() => setPending(null)}>
                取消
              </button>
              <button className="flex-1 rounded-lg bg-brand p-[11px] text-sm font-semibold text-white" onClick={goToAlbum}>
                進入相簿
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
