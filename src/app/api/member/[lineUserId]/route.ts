import type { NextRequest } from "next/server";
import { requireLineIdentity } from "@/server/line";
import { findMemberRecord, readMemberIg } from "@/server/qsprint";
import { serverError } from "@/server/http";

// 查詢會員是否存在（用 LINE userId）
// 必須先通過 LIFF ID Token 驗證，且只允許查詢「驗證身分＝路徑參數」這一筆（防 IDOR）。
export async function GET(req: NextRequest, ctx: RouteContext<"/api/member/[lineUserId]">) {
  const auth = await requireLineIdentity(req);
  if ("response" in auth) return auth.response;
  try {
    const { lineUserId } = await ctx.params;
    if (decodeURIComponent(lineUserId) !== auth.lineUserId) {
      return Response.json({ error: "無權限查詢此會員資料" }, { status: 403 });
    }
    const r = await findMemberRecord(auth.lineUserId);
    if (!r) return Response.json({ found: false });
    return Response.json({
      found: true,
      member: {
        playerName: r["選手姓名"] || "",
        group: r["組別"] || "",
        school: r["學校"] || "",
        email: r["E-MAIL"] || "",
        phone: r["電話"] || "",
        ig: readMemberIg(r),
        lineName: r["LINE 名稱"] || "",
        lineUserId: r["LINE userId"] || "",
        accountStatus: r["帳號狀態"] || r["1001223"] || "",
      },
    });
  } catch (err) {
    return serverError(err, "查詢會員失敗");
  }
}
