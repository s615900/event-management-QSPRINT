import { listPickablePhotographers } from "@/server/photographers";
import { serverError } from "@/server/http";

export const dynamic = "force-dynamic";

// GET /api/photographers — 前台報名頁的攝影師選單（只有名字，不含電話備註）
export async function GET() {
  try {
    return Response.json(await listPickablePhotographers());
  } catch (err) {
    return serverError(err, "讀取攝影師名單失敗");
  }
}
