import { adminRoute } from "@/server/admin/route";
import { distinctColumn } from "@/server/admin/data";
import { SHEET } from "@/server/ragic";

// 賽事名稱下拉選單來源（賽事資訊總表）
export const GET = adminRoute("讀取賽事名稱下拉選單失敗", async () =>
  Response.json({ items: await distinctColumn(SHEET.EVENT_LOOKUP, "賽事名稱") }),
);
