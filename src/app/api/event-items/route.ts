import { eachRecord, normalize, ragicGet, SHEET } from "@/server/ragic";
import { serverError } from "@/server/http";

export const dynamic = "force-dynamic";

// 報名頁「項目分類 → 比賽項目」兩層選單，來源是 Ragic「比賽項目表」裡啟用中的項目。
// 分類必須和「賽事報名表」項目分類單選欄位的選項一致（目前是 徑賽／跳部／擲部），否則 Ragic 會拒收。
export async function GET() {
  try {
    const data = await ragicGet(SHEET.EVENT_ITEMS);
    const rows: Array<{ id: number; category: string; name: string }> = [];
    eachRecord(data, (r, id) => {
      const enabled = normalize(r["是否啟用"]);
      if (!enabled || ["No", "否", "✘"].includes(enabled)) return;
      // 項目名稱在 Ragic 裡有些帶零寬空白，normalize 去掉
      const category = normalize(r["項目分類"]);
      const name = normalize(r["項目名稱"]);
      if (category && name) rows.push({ id: Number(id), category, name });
    });
    rows.sort((a, b) => a.id - b.id);
    const groups: Array<{ category: string; items: string[] }> = [];
    for (const r of rows) {
      let g = groups.find((x) => x.category === r.category);
      if (!g) groups.push((g = { category: r.category, items: [] }));
      if (!g.items.includes(r.name)) g.items.push(r.name);
    }
    return Response.json(groups);
  } catch (err) {
    return serverError(err, "讀取比賽項目失敗");
  }
}
