"use client";

import { countyRank } from "@/lib/counties";
import { useEffect, useState } from "react";
import { V1Header } from "@/components/v1-ui";
import { btnPrimary, Card, Container, Field, inputCls, Loading } from "@/components/line-ui";
import { authHeaders, fetchMember, getLiff, isPreviewMode } from "@/lib/liff";
import { cache, saveMember } from "@/lib/member-cache";

const GROUPS: { label: string; options: { value: string; disabled?: boolean }[] }[] = [
  { label: "高中", options: [{ value: "高中男生" }, { value: "高中女生" }] },
  { label: "公開", options: [{ value: "公開男生" }, { value: "公開女生" }] },
];

type SchoolItem = { name: string; type: string; county: string };
const NO_COUNTY = "其他／未分類";
type Form = { playerName: string; group: string; school: string; phone: string; email: string; ig: string };
type Errors = Partial<Record<keyof Form, boolean>>;

export default function RegisterPage() {
  const [stage, setStage] = useState<"loading" | "form" | "failed">("loading");
  const [lineName, setLineName] = useState("—");
  const [lineUid, setLineUid] = useState("");
  const [picture, setPicture] = useState("");
  const [idToken, setIdToken] = useState("");
  const [schools, setSchools] = useState<SchoolItem[] | null>(null);
  const [county, setCounty] = useState("");
  const [schoolError, setSchoolError] = useState(false);
  const [form, setForm] = useState<Form>({ playerName: "", group: "", school: "", phone: "", email: "", ig: "@" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [failMessage, setFailMessage] = useState("");

  useEffect(() => {
    async function init() {
      let uid = "";
      let token = "";
      const applyPreview = () => {
        uid = cache.get("lineUserId") || "preview_user_001";
        const name = cache.get("lineName") || "預覽用戶";
        cache.set("lineUserId", uid);
        cache.set("lineName", name);
        setLineName(name);
        setLineUid("ID: " + uid);
      };
      try {
        const liff = await getLiff();
        if (isPreviewMode()) {
          applyPreview();
        } else {
          // LINE App 內已自動登入，不可再呼叫 liff.login()；僅一般瀏覽器且未登入時才導向登入
          if (!liff.isInClient() && !liff.isLoggedIn()) {
            liff.login({ redirectUri: window.location.href });
            return;
          }
          const profile = await liff.getProfile();
          uid = profile.userId;
          token = liff.getIDToken() || "";
          cache.set("lineUserId", uid);
          cache.set("lineName", profile.displayName);
          setLineName(profile.displayName);
          setLineUid("ID: " + uid);
          if (profile.pictureUrl) {
            setPicture(profile.pictureUrl);
            cache.set("linePicture", profile.pictureUrl);
          }
        }
      } catch {
        if (!isPreviewMode()) {
          setStage("failed");
          return;
        }
        applyPreview();
      }
      setIdToken(token);

      // 會員資料已鎖定：已是會員且帳號啟用 → 回到首頁選單。帳號停用（曾解除綁定）→ 留在本頁重新登錄
      try {
        const mdata = await fetchMember(uid, token);
        if (mdata.found && mdata.member && mdata.member.accountStatus !== "停用") {
          saveMember(mdata.member);
          window.location.href = "/"; // 已是會員：回到首頁選單
          return;
        }
      } catch (err) {
        // 查不到是否已登錄時不能顯示表單，否則已登錄的選手會重複建檔（預覽模式沒有 LINE 憑證，照常顯示）
        if (!isPreviewMode()) {
          setFailMessage((err as Error).message);
          setStage("failed");
          return;
        }
      }

      try {
        const res = await fetch("/api/schools");
        const list = await res.json();
        setSchools(Array.isArray(list) ? list : []);
      } catch {
        setSchoolError(true);
      }
      setStage("form");
    }
    init();
  }, []);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const errs: Errors = {
      playerName: !form.playerName.trim(),
      group: !form.group,
      school: !form.school,
      phone: !form.phone.trim(),
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
      // Ragic 選手資料表的 IG 是必填；只有預設的「@」不算填寫
      ig: !form.ig.trim() || form.ig.trim() === "@",
    };
    setErrors(errs);
    return !Object.values(errs).some(Boolean);
  }

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    const igVal = form.ig.trim();
    const payload = {
      lineUserId: cache.get("lineUserId"),
      lineName: cache.get("lineName"),
      playerName: form.playerName.trim(),
      group: form.group,
      school: form.school,
      phone: form.phone.trim(),
      email: form.email.trim(),
      ig: igVal === "@" ? "" : igVal,
      pictureUrl: cache.get("linePicture"),
    };
    try {
      const res = await fetch("/api/member", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(idToken) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // 只有 API 真正成功寫入 Ragic，才把會員狀態存進 localStorage
        saveMember(payload);
        window.location.href = "/"; // 登錄完回到首頁選單
      } else if (res.status === 409) {
        alert("您的會員資料已建立並鎖定，將回到首頁選單。如需修改請聯絡管理員。");
        window.location.href = "/";
      } else {
        alert("送出失敗：" + (data.error || "請再試一次"));
        setSubmitting(false);
      }
    } catch {
      alert("網路錯誤，請再試一次");
      setSubmitting(false);
    }
  }

  // 縣市：Ragic 學校清單有填「縣市」才顯示縣市選單；沒填縣市的學校歸在「其他／未分類」
  const hasCounty = !!schools?.some((s) => s.county);
  const counties = [...new Set((schools ?? []).map((s) => s.county || NO_COUNTY))].sort((a, b) =>
    a === NO_COUNTY ? 1 : b === NO_COUNTY ? -1 : countyRank(a) - countyRank(b) || a.localeCompare(b, "zh-TW"),
  );
  const schoolsInCounty = !schools ? [] : hasCounty ? schools.filter((s) => (s.county || NO_COUNTY) === county) : schools;

  return (
    <>
      <V1Header title="📝 選手資料登錄" subtitle="請填寫選手基本資料（僅需填寫一次）" back />
      <Container>
        {stage === "loading" && <Loading text="載入中..." />}
        {stage === "failed" && (
          <div className="p-10 text-center text-[#666]">
            {failMessage || "LINE 登入失敗，請從 LINE 重新開啟此連結"}，或
            <a href="#" className="text-brand underline" onClick={(e) => { e.preventDefault(); location.reload(); }}>點此重試</a>。
          </div>
        )}
        {stage === "form" && (
          <div>
            <Card>
              <Field label="LINE 帳號">
                <div className="flex items-center gap-2.5 rounded-lg border border-brand-line bg-brand-soft px-3.5 py-3">
                  {picture ? (
                    // eslint-disable-next-line @next/next/no-img-element -- LINE 大頭照網域不固定
                    <img src={picture} alt="頭像" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-xl text-white">👤</div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-brand-dark">{lineName}</div>
                    <div className="mt-0.5 text-[11px] text-[#666]">{lineUid}</div>
                  </div>
                </div>
              </Field>
            </Card>

            <Card>
              <Field label="選手姓名" required error={errors.playerName && "請填寫選手姓名"}>
                <input className={inputCls} value={form.playerName} onChange={set("playerName")} placeholder="請輸入真實姓名" />
              </Field>
              <Field label="組別" required error={errors.group && "請選擇組別"}>
                <select className={inputCls} value={form.group} onChange={set("group")}>
                  <option value="">請選擇組別</option>
                  {GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value} disabled={o.disabled}>
                          {o.disabled ? `🔒 ${o.value}（暫不開放）` : o.value}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              {hasCounty && (
                <Field label="縣市" required={false}>
                  <select
                    className={inputCls}
                    value={county}
                    onChange={(e) => {
                      setCounty(e.target.value);
                      setForm((f) => ({ ...f, school: "" }));
                    }}
                  >
                    <option value="">{schools ? "請選擇縣市" : "載入中..."}</option>
                    {counties.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              )}
              <Field label="學校" required error={errors.school && "請選擇學校"}>
                <select className={inputCls} value={form.school} onChange={set("school")} disabled={hasCounty && !county}>
                  <option value="">
                    {schoolError ? "載入失敗，請重新整理" : !schools ? "載入學校清單中..." : hasCounty && !county ? "請先選擇縣市" : "請選擇學校"}
                  </option>
                  {schoolsInCounty.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="電話" required error={errors.phone && "請填寫電話"}>
                <input className={inputCls} type="tel" inputMode="numeric" value={form.phone} onChange={set("phone")} placeholder="請輸入聯絡電話" />
              </Field>
              <Field label="E-Mail" required error={errors.email && "請填寫正確的 Email"}>
                <input className={inputCls} type="email" value={form.email} onChange={set("email")} placeholder="請輸入電子郵件" />
              </Field>
              <Field label="IG 聯絡資訊" required error={errors.ig && "請填寫 IG 帳號（例如 @yourname）"}>
                <input className={inputCls} value={form.ig} onChange={set("ig")} placeholder="@yourname" />
              </Field>
            </Card>

            <div className="mt-1.5 rounded-md bg-[#fffbe6] px-2.5 py-2 text-xs text-[#888]">
              ⚠️ 資料填寫後即綁定您的 LINE 帳號，之後報名無需重複填寫。
            </div>
            <br />
            <button className={btnPrimary} disabled={submitting} onClick={submit}>
              {submitting ? "送出中..." : "儲存並完成登錄"}
            </button>
          </div>
        )}
      </Container>
    </>
  );
}
