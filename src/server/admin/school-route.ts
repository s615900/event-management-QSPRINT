import "server-only";
import type { NextRequest } from "next/server";
import { adminRoute } from "./route";
import type { AdminSession } from "./session";

// 學校名單 API：管理員，或攝影師帳號且有「學校名單權限」才能用
export function schoolRoute<C = unknown>(
  label: string,
  handler: (req: NextRequest, session: AdminSession, ctx: C) => Promise<Response>,
) {
  return adminRoute<C>(
    label,
    async (req, session, ctx) => {
      if (session.role === "staff" && !session.schoolAccess) {
        return Response.json({ error: "沒有學校名單權限" }, { status: 403 });
      }
      return handler(req, session, ctx);
    },
    { allowStaff: true },
  );
}
