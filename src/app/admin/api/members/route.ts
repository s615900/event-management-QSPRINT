import { adminRoute, pageParams } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { fetchAll, fetchItemTagsByLineUserId, toMemberListItem } from "@/server/admin/data";
import { MEMBER_FIELD, normalize, ragicPost, SHEET } from "@/server/ragic";
import { readBody } from "@/server/http";

export const GET = adminRoute("查詢選手資料表失敗", async (req) => {
  const sp = req.nextUrl.searchParams;
  const q = normalize(sp.get("q")).toLowerCase();
  const school = normalize(sp.get("school"));
  const group = normalize(sp.get("group"));
  const order = sp.get("order") === "asc" ? "asc" : "desc"; // 依建立時間（Ragic 記錄 ID）
  const { limit, offset } = pageParams(req);

  const [all, itemTags] = await Promise.all([fetchAll(SHEET.MEMBER, order === "desc"), fetchItemTagsByLineUserId()]);
  const filtered = all.filter(({ rec }) => {
    if (school && normalize(rec["學校"]) !== school) return false;
    if (group && normalize(rec["組別"]) !== group) return false;
    if (q) {
      const haystack = normalize(`${rec["選手姓名"] || ""} ${rec["電話"] || ""} ${rec["青春止秒選手編號"] || ""}`).toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const page = filtered.slice(offset, offset + limit);
  return Response.json({
    items: page.map(({ id, rec }) => toMemberListItem(rec, id, itemTags)),
    total: filtered.length,
    hasMore: offset + page.length < filtered.length,
  });
});

// 後台手動新增選手（現場報到但尚未透過 LINE 登錄）。刻意不寫入 LINE userId／LINE 名稱。
export const POST = adminRoute("新增選手失敗", async (req, session) => {
  const body = await readBody(req);
  const playerName = normalize(body.playerName);
  const phone = normalize(body.phone);
  if (!playerName || !phone) return Response.json({ error: "請填寫姓名、聯絡電話" }, { status: 400 });

  const writeBody: Record<string, string> = {
    [MEMBER_FIELD.playerName]: playerName,
    [MEMBER_FIELD.phone]: phone,
    [MEMBER_FIELD.accountStatus]: "啟用",
  };
  if (body.school) writeBody[MEMBER_FIELD.school] = normalize(body.school);
  if (body.group) writeBody[MEMBER_FIELD.group] = normalize(body.group);
  await ragicPost(SHEET.MEMBER, writeBody, { strict: true });
  await writeAuditLog(session, "新增", `選手資料表 - ${playerName}`, `後台手動新增選手：${playerName} / ${phone}`);
  return Response.json({ success: true });
});
