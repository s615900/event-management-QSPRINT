import { adminRoute } from "@/server/admin/route";
import { distinctColumn } from "@/server/admin/data";
import { SHEET } from "@/server/ragic";

// 學校名稱下拉選單來源（國高中職學校清單）
export const GET = adminRoute("讀取學校名稱下拉選單失敗", async () =>
  Response.json({ items: await distinctColumn(SHEET.SCHOOL_LOOKUP, "學校名稱") }),
);
