import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { fetchAll } from "@/server/admin/data";
import { ALBUM_FIELD, normalize, ragicPost, RAGIC_YES, SHEET } from "@/server/ragic";
import { readBody } from "@/server/http";

export const GET = adminRoute("查詢賽事相簿列表失敗", async () => {
  const items = (await fetchAll(SHEET.ALBUM)).map(({ id, rec }) => ({
    id,
    eventName: rec["賽事名稱"] || "",
    school: rec["學校名稱"] || "",
    albumUrl: rec["Google雲端連結"] || "",
    isOpen: rec["是否開放相簿"] === RAGIC_YES,
  }));
  return Response.json({ items });
});

export const POST = adminRoute("新增相簿失敗", async (req, session) => {
  const body = await readBody(req);
  const eventName = normalize(body.eventName);
  const school = normalize(body.school);
  const albumUrl = normalize(body.albumUrl);
  if (!eventName || !school || !albumUrl) {
    return Response.json({ error: "請填寫賽事名稱、學校名稱、相簿連結" }, { status: 400 });
  }
  const isOpen = body.isOpen === "Yes" ? "Yes" : "No";
  await ragicPost(
    SHEET.ALBUM,
    {
      [ALBUM_FIELD.eventName]: eventName,
      [ALBUM_FIELD.school]: school,
      [ALBUM_FIELD.albumUrl]: albumUrl,
      [ALBUM_FIELD.isOpen]: isOpen,
    },
    { strict: true },
  );
  await writeAuditLog(
    session,
    "新增",
    `賽事相簿 - ${eventName} / ${school}`,
    `新增相簿連結：${albumUrl}（${isOpen === "Yes" ? "已開放" : "未開放"}）`,
  );
  return Response.json({ success: true });
});
