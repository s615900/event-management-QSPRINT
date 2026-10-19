import "server-only";
import crypto from "node:crypto";
import { listAdmins, setAdminLineUserId } from "./admin/admins";
import { multicastText } from "./line";
import { listRoster, PICKABLE_ROLE, setStaffLineUserId } from "./photographers";

// 新選手加入／新報名時，用 LINE 推播通知攝影師與管理員。
// 收件人要先「綁定」：後台每位人員旁有一組綁定碼，本人在官方帳號聊天室傳「綁定 碼」，webhook 就把 LINE userId 寫回 Ragic。

export type RecipientKind = "staff" | "admin";

export interface Recipient {
  kind: RecipientKind;
  id: string;
  name: string;
  active: boolean;
  lineUserId: string;
  code: string;
}

// 綁定碼由 SESSION_SECRET 對「類型:記錄ID」簽章而來，不用另外存；Ragic 記錄 ID 不變，碼就不變
export function bindCode(kind: RecipientKind, id: string | number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("缺少 SESSION_SECRET 環境變數");
  return crypto.createHmac("sha256", secret).update(`${kind}:${id}`).digest("hex").slice(0, 8).toUpperCase();
}

export async function listRecipients(): Promise<Recipient[]> {
  const [roster, admins] = await Promise.all([listRoster(), listAdmins()]);
  return [
    ...admins.map((a) => ({ kind: "admin" as const, id: a.id, name: a.name, active: a.active, lineUserId: a.lineUserId, code: bindCode("admin", a.id) })),
    ...roster.map((p) => ({ kind: "staff" as const, id: String(p.id), name: p.name, active: p.active, lineUserId: p.lineUserId, code: bindCode("staff", p.id) })),
  ];
}

// 用綁定碼綁定 LINE 帳號；回傳綁定到的人員名稱，碼不對回傳 null
export async function bindLineAccount(code: string, lineUserId: string): Promise<string | null> {
  const target = code.trim().toUpperCase();
  const found = (await listRecipients()).find((r) => r.code === target);
  if (!found) return null;
  if (found.kind === "admin") await setAdminLineUserId(found.id, lineUserId);
  else await setStaffLineUserId(Number(found.id), lineUserId);
  return found.name;
}

// 通知所有已綁定的啟用管理員，加上指定攝影師（photographer＝名稱；"all"＝所有在職攝影師）。失敗只記錄，不影響主流程
export async function notifyStaffAndAdmins(text: string, photographer: string | "all" | null): Promise<void> {
  try {
    const roster = await listRoster();
    const staff = roster.filter(
      (p) => p.active && (photographer === "all" ? p.role === PICKABLE_ROLE : photographer !== null && p.name === photographer),
    );
    const admins = (await listAdmins()).filter((a) => a.active);
    const ids = [...staff, ...admins].map((r) => r.lineUserId).filter(Boolean);
    if (ids.length) await multicastText(ids, text);
  } catch (err) {
    console.error("LINE 通知攝影師／管理員失敗", err);
  }
}
