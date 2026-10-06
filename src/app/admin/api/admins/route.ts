import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { AdminListError, addAdmin, listAdmins } from "@/server/admin/admins";
import { listStaffAdmins } from "@/server/photographers";

// 管理員權限頁：Ragic 管理員清單＋有勾後台權限的攝影師
export const GET = adminRoute("讀取管理員清單失敗", async (_req, session) => {
  const [admins, staff] = await Promise.all([listAdmins(), listStaffAdmins()]);
  return Response.json({ admins, staff, me: session.email.toLowerCase() });
});

export const POST = adminRoute("新增管理員失敗", async (req, session) => {
  try {
    const a = await addAdmin(await req.json().catch(() => ({})));
    await writeAuditLog(session, "新增", `後台網站管理員清單 - ${a.name}`, `新增管理員：${a.name}（${a.email}）`);
    return Response.json(a, { status: 201 });
  } catch (err) {
    if (err instanceof AdminListError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
});
