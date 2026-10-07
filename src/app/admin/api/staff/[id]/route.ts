import type { NextRequest } from "next/server";
import { adminRoute } from "@/server/admin/route";
import { writeAuditLog } from "@/server/admin/audit";
import { deleteStaff, listStaffWithCounts, StaffError, updateStaff, type Photographer } from "@/server/photographers";

type Ctx = RouteContext<"/admin/api/staff/[id]">;

function staffError(err: unknown) {
  if (err instanceof StaffError) return Response.json({ error: err.message }, { status: err.status });
  throw err;
}

const LABELS: Array<[keyof Photographer, string]> = [
  ["name", "名稱"],
  ["role", "職務"],
  ["phone", "電話"],
  ["notes", "備註"],
  ["email", "Email"],
];

export const PATCH = adminRoute("更新人員失敗", async (req: NextRequest, session, ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  try {
    const input = await req.json().catch(() => ({}));
    // 不能把自己正在登入的攝影師帳號停用、拿掉後台權限或改掉 Email（會把自己鎖在外面）
    const current = (await listStaffWithCounts(true)).find((p) => p.id === id);
    const me = session.email.trim().toLowerCase();
    if (current?.adminAccess && current.email === me) {
      const locksOut =
        input.active === false || input.adminAccess === false || (input.email !== undefined && String(input.email).trim().toLowerCase() !== me);
      if (locksOut) return Response.json({ error: "不能停用或修改自己正在登入的帳號，請請其他管理員操作" }, { status: 400 });
    }
    const { before, after } = await updateStaff(id, input);
    const changes = LABELS.filter(([k]) => before[k] !== after[k]).map(([k, label]) => `${label}：「${before[k]}」→「${after[k]}」`);
    if (before.active !== after.active) {
      await writeAuditLog(session, "開關切換", `攝影師名單 - ${after.name}`, `狀態：「${before.active ? "在職" : "停用"}」→「${after.active ? "在職" : "停用"}」`);
    }
    if (before.albumAccess !== after.albumAccess) {
      await writeAuditLog(session, "開關切換", `攝影師名單 - ${after.name}`, `相簿權限：「${before.albumAccess ? "有" : "無"}」→「${after.albumAccess ? "有" : "無"}」`);
    }
    if (before.schoolAccess !== after.schoolAccess) {
      await writeAuditLog(session, "開關切換", `攝影師名單 - ${after.name}`, `學校名單權限：「${before.schoolAccess ? "有" : "無"}」→「${after.schoolAccess ? "有" : "無"}」`);
    }
    if (before.adminAccess !== after.adminAccess) {
      await writeAuditLog(session, "開關切換", `攝影師名單 - ${after.name}`, `後台權限：「${before.adminAccess ? "可登入" : "無"}」→「${after.adminAccess ? "可登入" : "無"}」`);
    }
    if (changes.length) await writeAuditLog(session, "編輯", `攝影師名單 - ${before.name}`, changes.join("；"));
    return Response.json(after);
  } catch (err) {
    return staffError(err);
  }
});

export const DELETE = adminRoute("刪除人員失敗", async (_req: NextRequest, session, ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  try {
    const p = await deleteStaff(id);
    await writeAuditLog(session, "刪除", `攝影師名單 - ${p.name}`, "刪除人員");
    return Response.json({ success: true });
  } catch (err) {
    return staffError(err);
  }
});
