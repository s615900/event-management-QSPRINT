"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/line-ui";
import { V1Container, V1Header } from "@/components/v1-ui";
import { authHeaders, getLiff, isPreviewMode } from "@/lib/liff";
import { clearAll } from "@/lib/member-cache";
import { cache, saveMember } from "@/lib/member-cache";

// 第一版的首頁選單：登入後讓選手自己選要去哪一頁
const MEMBER_ENTRIES = [
  { href: "/form", icon: "🏅", title: "賽事拍攝登記", desc: "選擇賽事與項目，線上完成報名" },
  { href: "/history", icon: "📋", title: "賽事拍攝紀錄", desc: "查看已報名的賽事與號碼" },
  { href: "/album", icon: "📂", title: "賽事相簿", desc: "查看您參加的賽事相簿資料夾" },
];
const REGISTER_ENTRY = { href: "/register", icon: "📝", title: "選手資料登錄", desc: "第一次使用請先登錄基本資料（僅需一次）" };

// 入口頁：LIFF 初始化 → 查詢會員 → 顯示功能選單（新用戶只能先登錄）
// 登出：清掉這支手機上記住的資料，回到首頁重新登入
async function logout() {
  try {
    const liff = await getLiff();
    if (liff.isLoggedIn()) liff.logout();
  } catch {}
  clearAll();
  window.location.href = "/?t=" + Date.now();
}

export default function IndexPage() {
  const [status, setStatus] = useState("載入中...");
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ isMember: boolean; name: string } | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setStatus("LINE 驗證中...");
        const liff = await getLiff();

        // 診斷模式：網址加 ?debug=1 顯示 LIFF 狀態並停在此頁（不自動跳轉）
        if (new URL(window.location.href).searchParams.get("debug") === "1") {
          let info = "";
          try {
            info =
              `init OK\nisInClient: ${liff.isInClient()}\nisLoggedIn: ${liff.isLoggedIn()}\n` +
              `OS: ${liff.getOS()}\nSDK: ${liff.getVersion()}\nLINE: ${liff.getLineVersion() || "N/A"}`;
            if (liff.isLoggedIn()) {
              const p = await liff.getProfile();
              info += `\nuserId: ${p.userId}\nname: ${p.displayName}`;
            }
          } catch (de) {
            const e = de as { code?: string; message?: string };
            info += `\ngetProfile error: ${e.code || ""} ${e.message || String(de)}`;
          }
          setDebugInfo(info);
          return;
        }

        // 開發／展示用：網址加 ?preview=1 才套用預覽帳號，不需 LINE 登入
        if (isPreviewMode()) {
          if (!cache.get("lineUserId")) {
            cache.set("lineUserId", "preview_user_001");
            cache.set("lineName", "預覽用戶");
          }
          if (!cache.get("memberName")) {
            saveMember({
              playerName: "陳小明",
              group: "公開男生",
              school: "國立臺灣師範大學",
              email: "preview@example.com",
              phone: "0912345678",
            });
          }
          setMenu({ isMember: true, name: cache.get("memberName") });
          return;
        }

        // LINE App 內已自動登入，不可再呼叫 liff.login()（會出現「系統發生問題」）；
        // 僅在一般瀏覽器且未登入時才導向 LINE 登入
        if (!liff.isInClient() && !liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await liff.getProfile();
        const idToken = liff.getIDToken() || "";
        cache.set("lineUserId", profile.userId);
        cache.set("lineName", profile.displayName);
        if (profile.pictureUrl) cache.set("linePicture", profile.pictureUrl);

        setStatus("查詢會員資料...");
        const res = await fetch(`/api/member/${encodeURIComponent(profile.userId)}`, { headers: authHeaders(idToken) });
        const data = await res.json();
        if (data.found && data.member.accountStatus !== "停用") {
          saveMember(data.member);
          setMenu({ isMember: true, name: data.member.playerName || profile.displayName });
        } else {
          // 新用戶或已解除綁定：要先完成選手資料登錄
          cache.set("isMember", "false");
          setMenu({ isMember: false, name: profile.displayName });
        }
      } catch (err) {
        console.error("初始化失敗:", err);
        if (isPreviewMode()) {
          window.location.href = "/register?preview=1";
          return;
        }
        const e = err as { code?: string; name?: string; message?: string };
        setError(`(${e.code || e.name || ""} ${e.message || String(err)})`);
      }
    }
    init();
  }, []);

  if (menu) {
    const entries = menu.isMember ? MEMBER_ENTRIES : [REGISTER_ENTRY];
    return (
      <>
        <V1Header title="🏅 田徑賽事拍攝登記" subtitle={menu.name ? `${menu.name}，歡迎使用` : "歡迎使用"} />
        <V1Container>
          {!menu.isMember && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-gray-600">
              ⚠️ 尚未登錄選手資料，請先完成登錄才能報名賽事。
            </p>
          )}
          <div className="flex flex-col gap-3">
            {entries.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand hover:shadow-md"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl">{e.icon}</div>
                <div>
                  <div className="font-semibold text-gray-900">{e.title}</div>
                  <div className="mt-0.5 text-[13px] text-gray-500">{e.desc}</div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button type="button" onClick={logout} className="text-[13px] text-gray-500 underline-offset-2 hover:text-danger hover:underline">
              登出
            </button>
          </div>
        </V1Container>
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center text-[#666]">
        {!debugInfo && !error && <Spinner size={40} />}
        {debugInfo ? (
          <p className="mt-3 whitespace-pre-line text-left text-[15px]">{debugInfo}</p>
        ) : error ? (
          <p className="mt-3 text-[15px]">
            LINE 登入失敗，請從 LINE 重新開啟此連結，或
            <a href="#" className="text-brand underline" onClick={(e) => { e.preventDefault(); location.reload(); }}>
              點此重試
            </a>
            。
            <br />
            <small className="text-[#999]">{error}</small>
          </p>
        ) : (
          <p className="mt-3 text-[15px]">{status}</p>
        )}
      </div>
    </div>
  );
}
