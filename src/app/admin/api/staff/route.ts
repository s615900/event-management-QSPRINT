import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { createStaff, listStaffWithCounts, StaffError } from "@/server/photographers";

export const GET = adminRoute("讀取人員名單失敗", async (req) => {
  const all = req.nextUrl.searchParams.get("include_inactive") === "true";
  return Response.json({ items: await listStaffWithCounts(all) });
});

export const POST = adminRoute("新增人員失敗", async (req, session) => {
  try {
    const p = await createStaff(await req.json().catch(() => ({})));
    await writeAuditLog(session, "新增", `攝影師名單 - ${p.name}`, `新增人員：${p.name}（${p.role}）`);
    return Response.json(p, { status: 201 });
  } catch (err) {
    if (err instanceof StaffError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
});
