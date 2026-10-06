import { eachRecord, ragicGet, SHEET } from "@/server/ragic";
import { parseEventDateRange, toIsoDate } from "@/server/dates";
import { serverError } from "@/server/http";

export const dynamic = "force-dynamic";

// 讀取開放報名的賽事清單（是否開放報名 === "Yes"，在程式裡過濾）
export async function GET() {
  try {
    const data = await ragicGet(SHEET.EVENT_OPEN_LIST);
    const events: Array<{ id: string; name: string; startDate: string; endDate: string }> = [];
    eachRecord(data, (ev, id) => {
      const name = ev["賽事名稱"] || "";
      const open = (ev["是否開放報名"] || "").trim();
      if (name && open === "Yes") {
        // 賽事名稱含可靠的日期區間（如 "115年9/12-16"），優先用它；Ragic 的「結束日期」欄位僅作備援
        const parsed = parseEventDateRange(name);
        events.push({
          id,
          name,
          startDate: parsed?.start || toIsoDate(ev["開始日期"] || ""),
          endDate: parsed?.end || toIsoDate(ev["結束日期"] || ""),
        });
      }
    });
    return Response.json(events);
  } catch (err) {
    return serverError(err, "讀取賽事失敗");
  }
}
