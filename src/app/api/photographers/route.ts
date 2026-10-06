import { listPickablePhotographers } from "@/server/photographers";
import { REGISTRATION_FIELD } from "@/server/ragic";
import { serverError } from "@/server/http";

export const dynamic = "force-dynamic";

// GET /api/photographers — 前台報名頁的攝影師選單（只有名字，不含電話備註）
export async function GET() {
  try {
    // 報名表還沒有「攝影師」欄位時存不了選擇，回傳空清單讓報名頁不顯示這個欄位
    if (!REGISTRATION_FIELD.photographer) return Response.json([]);
    return Response.json(await listPickablePhotographers());
  } catch (err) {
    return serverError(err, "讀取攝影師名單失敗");
  }
}
