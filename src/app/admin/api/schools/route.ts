import { schoolRoute } from "@/server/admin/school-route";
import { writeAuditLog } from "@/server/admin/audit";
import { fetchAll } from "@/server/admin/data";
import { normalize, ragicPost, SCHOOL_FIELD, SHEET } from "@/server/ragic";
import { readBody } from "@/server/http";

// 學校名單管理：列出所有學校（含 id、學籍）
export const GET = schoolRoute("讀取學校名單失敗", async () => {
  const rows = await fetchAll(SHEET.SCHOOL_LOOKUP, false);
  const items = rows
    .map(({ id, rec }) => ({ id, name: normalize(rec["學校名稱"]), type: normalize(rec["學籍"]), county: normalize(rec["縣市"]) }))
    .filter((s) => s.name);
  return Response.json({ items });
});

export const POST = schoolRoute("新增學校失敗", async (req, session) => {
  const body = await readBody(req);
  const name = normalize(body.name);
  const type = normalize(body.type);
  const county = normalize(body.county);
  if (!name) return Response.json({ error: "請填寫學校名稱" }, { status: 400 });
  const rows = await fetchAll(SHEET.SCHOOL_LOOKUP);
  if (rows.some(({ rec }) => normalize(rec["學校名稱"]) === name)) {
    return Response.json({ error: "這間學校已經在名單裡了" }, { status: 400 });
  }
  await ragicPost(SHEET.SCHOOL_LOOKUP, { [SCHOOL_FIELD.name]: name, [SCHOOL_FIELD.type]: type, [SCHOOL_FIELD.county]: county }, { strict: true });
  await writeAuditLog(session, "新增", `學校名單 - ${name}`, `新增學校：${name}（${county || "未填縣市"}・${type || "未填學籍"}）`);
  return Response.json({ success: true });
});
