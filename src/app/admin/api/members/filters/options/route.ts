import { adminRoute } from "@/server/admin/route";
import { fetchAll } from "@/server/admin/data";
import { normalize, SHEET } from "@/server/ragic";

// 選手篩選下拉選單來源（學校／組別），從既有資料去重取得
export const GET = adminRoute("查詢選手篩選選項失敗", async () => {
  const schools = new Set<string>();
  const groups = new Set<string>();
  for (const { rec } of await fetchAll(SHEET.MEMBER)) {
    const school = normalize(rec["學校"]);
    const group = normalize(rec["組別"]);
    if (school) schools.add(school);
    if (group) groups.add(group);
  }
  const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "zh-TW"));
  return Response.json({ schools: sort(schools), groups: sort(groups) });
});
