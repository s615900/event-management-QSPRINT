import { eachRecord, ragicGet, SHEET } from "@/server/ragic";
import { serverError } from "@/server/http";

export const dynamic = "force-dynamic";

// 讀取學校清單（依學籍 國中 → 高中 → 大學 排序）
export async function GET() {
  try {
    const data = await ragicGet(SHEET.SCHOOL);
    const schools: Array<{ name: string; type: string }> = [];
    eachRecord(data, (s) => {
      const name = s["學校名稱"] || "";
      if (name) schools.push({ name, type: s["學籍"] || "" });
    });
    const order: Record<string, number> = { 國中: 1, 高中: 2, 大學: 3 };
    schools.sort(
      (a, b) => (order[a.type] || 9) - (order[b.type] || 9) || a.name.localeCompare(b.name, "zh-TW"),
    );
    return Response.json(schools.map((s) => s.name));
  } catch (err) {
    return serverError(err, "讀取學校失敗");
  }
}
