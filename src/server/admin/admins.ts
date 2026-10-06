import "server-only";
import { ADMIN_FIELD, ADMIN_STATUS_ACTIVE, normalize, ragicPost, SHEET } from "../ragic";
import { fetchAll } from "./data";

// 後台網站管理員清單（Ragic）：誰可以用 Google 帳號登入後台

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AdminListError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function listAdmins(): Promise<AdminAccount[]> {
  return (await fetchAll(SHEET.ADMIN_LIST, false)).map(({ id, rec }) => ({
    id,
    name: normalize(rec["姓名"]),
    email: normalize(rec["Email"]).toLowerCase(),
    active: normalize(rec["狀態"]) === ADMIN_STATUS_ACTIVE,
  }));
}

export async function addAdmin(input: { name?: string; email?: string }): Promise<AdminAccount> {
  const name = normalize(input.name);
  const email = normalize(input.email).toLowerCase();
  if (!name || !email) throw new AdminListError("請填寫姓名與 Google Email", 400);
  if (!EMAIL_RE.test(email)) throw new AdminListError("Email 格式不正確", 400);
  const admins = await listAdmins();
  if (admins.some((a) => a.email === email)) throw new AdminListError("這個 Email 已經在管理員清單裡", 409);
  const result = await ragicPost(
    SHEET.ADMIN_LIST,
    { [ADMIN_FIELD.name]: name, [ADMIN_FIELD.email]: email, [ADMIN_FIELD.status]: ADMIN_STATUS_ACTIVE },
    { strict: true },
  );
  return { id: String(result.ragicId ?? ""), name, email, active: true };
}

// 修改姓名／Email／啟用狀態。不能停用或改掉「自己」的帳號，也不能讓清單裡沒有任何啟用中的管理員。
export async function updateAdmin(
  id: string,
  input: { name?: string; email?: string; active?: boolean },
  currentEmail: string,
): Promise<{ before: AdminAccount; after: AdminAccount }> {
  const admins = await listAdmins();
  const before = admins.find((a) => a.id === id);
  if (!before) throw new AdminListError("查無此管理員", 404);

  const after = { ...before };
  if (input.name !== undefined) {
    after.name = normalize(input.name);
    if (!after.name) throw new AdminListError("請填寫姓名", 400);
  }
  if (input.email !== undefined) {
    after.email = normalize(input.email).toLowerCase();
    if (!EMAIL_RE.test(after.email)) throw new AdminListError("Email 格式不正確", 400);
    if (admins.some((a) => a.id !== id && a.email === after.email)) {
      throw new AdminListError("這個 Email 已經在管理員清單裡", 409);
    }
  }
  if (input.active !== undefined) after.active = Boolean(input.active);

  const isSelf = before.email === currentEmail.trim().toLowerCase();
  if (isSelf && (!after.active || after.email !== before.email)) {
    throw new AdminListError("不能停用或修改自己正在登入的帳號，請請其他管理員操作", 400);
  }
  if (before.active && !after.active && admins.filter((a) => a.active).length <= 1) {
    throw new AdminListError("至少要保留一位啟用中的管理員", 400);
  }

  const writeBody: Record<string, string> = {};
  if (after.name !== before.name) writeBody[ADMIN_FIELD.name] = after.name;
  if (after.email !== before.email) writeBody[ADMIN_FIELD.email] = after.email;
  if (after.active !== before.active) writeBody[ADMIN_FIELD.status] = after.active ? ADMIN_STATUS_ACTIVE : "停用";
  if (Object.keys(writeBody).length) await ragicPost(`${SHEET.ADMIN_LIST}/${id}`, writeBody, { strict: true });
  return { before, after };
}
