import "server-only";
import type { AdminSession } from "./session";

// 相簿管理的範圍：管理員看全部；有「相簿權限」的攝影師只看自己的；其他攝影師帳號不能用
export function albumScope(session: AdminSession): { photographer: string | null } | { response: Response } {
  if (session.role === "admin") return { photographer: null };
  if (session.albumAccess) return { photographer: session.name };
  return { response: Response.json({ error: "這個帳號沒有相簿權限" }, { status: 403 }) };
}
