import "server-only";
import type { NextRequest } from "next/server";
import { requireAdminApi, type AdminSession } from "./session";
import { serverError } from "../http";

// 後台 API 共用外殼：先驗證登入（401）與權限（預設只有管理員，攝影師 403），再執行 handler，例外統一回 500
export function adminRoute<C = unknown>(
  label: string,
  handler: (req: NextRequest, session: AdminSession, ctx: C) => Promise<Response>,
  { allowStaff = false }: { allowStaff?: boolean } = {},
) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const auth = await requireAdminApi({ allowStaff });
    if ("response" in auth) return auth.response;
    try {
      return await handler(req, auth.session, ctx);
    } catch (err) {
      return serverError(err, label);
    }
  };
}

export function pageParams(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);
  return { limit, offset };
}
