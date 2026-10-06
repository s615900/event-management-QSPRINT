import type { NextRequest } from "next/server";
import { countRegistrationsForDate, findEventRecordByName, parseDailySchedule } from "@/server/qsprint";
import { serverError } from "@/server/http";

// 依日期核對某場賽事「賽事每日場次」的人數上限。額滿判斷即時查賽事報名表算出。
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/events/[eventName]/available-dates">) {
  try {
    const eventName = decodeURIComponent((await ctx.params).eventName);
    const eventRecord = await findEventRecordByName(eventName);
    if (!eventRecord) return Response.json({ error: "找不到此賽事" }, { status: 404 });
    const results: Array<{ date: string; status: "open" | "full"; capacity: number; registered: number }> = [];
    for (const row of parseDailySchedule(eventRecord)) {
      const registered = await countRegistrationsForDate(eventName, row.date);
      results.push({
        date: row.date,
        status: registered >= row.capacity ? "full" : "open",
        capacity: row.capacity,
        registered,
      });
    }
    results.sort((a, b) => a.date.localeCompare(b.date));
    return Response.json(results);
  } catch (err) {
    return serverError(err, "查詢賽事每日名額失敗");
  }
}
