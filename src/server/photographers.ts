import "server-only";
import {
  eachRecord,
  normalize,
  PHOTOGRAPHER_FIELD,
  ragicDelete,
  ragicGet,
  ragicPost,
  REGISTRATION_FIELD,
  SHEET,
  type RagicRecord,
} from "./ragic";
import { taipeiToday } from "./dates";

// 攝影師名單（參考 studio-nextjs 的人員管理），存在 Ragic「攝影師名單」（new-test-parameters/7）。
// 選手選了哪位攝影師，記在「賽事報名表」的「攝影師」欄位（存攝影師名稱，在 Ragic 直接看得懂）。

export const STAFF_ROLES = ["攝影師", "小編"] as const;
// 選手報名時能挑的只有「在職」且職務是攝影師的人
export const PICKABLE_ROLE = "攝影師";

const STATUS_ACTIVE = "在職";
const STATUS_INACTIVE = "離職";

export interface Photographer {
  id: number; // Ragic 記錄 ID
  name: string; // 報名頁會顯示這個名字
  role: string;
  phone: string;
  notes: string;
  email: string; // Google 帳號，打開後台權限時用來登入後台
  adminAccess: boolean; // 可以登入後台（只能看儀表板和自己的拍攝行程）
  albumAccess: boolean; // 可以在後台管理自己被選到的賽事相簿（需同時有後台權限）
  schoolAccess: boolean; // 可以在後台管理學校名單（需同時有後台權限）
  active: boolean;
}

// 選手報名時選了某位攝影師的一筆報名
export interface PhotographerPick {
  playerName: string;
  eventName: string;
  date: string;
  time: string;
  itemCategory: string;
  eventItem: string;
  bibNumber: string;
  school: string;
  group: string;
}

export class StaffError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function toPhotographer(rec: RagicRecord, id: string): Photographer {
  return {
    id: Number(id),
    name: normalize(rec["名稱"]),
    role: normalize(rec["職務"]) || PICKABLE_ROLE,
    phone: normalize(rec["電話"]),
    notes: normalize(rec["備註"]),
    email: normalize(rec["Email"]).toLowerCase(),
    adminAccess: normalize(rec["後台權限"]) === "Yes",
    albumAccess: normalize(rec["相簿權限"]) === "Yes",
    schoolAccess: normalize(rec["學校名單權限"]) === "Yes",
    // 「在職」空白（例如直接在 Ragic 新增時沒選）也當作在職
    active: normalize(rec["在職"]) !== STATUS_INACTIVE,
  };
}

// 攝影師帳號每次操作都要確認權限，名單短時間快取，避免每個請求都打 Ragic；寫入時清掉
let rosterCache: { at: number; list: Photographer[] } | null = null;
const CACHE_MS = 15_000;

async function loadRoster(): Promise<Photographer[]> {
  if (rosterCache && Date.now() - rosterCache.at < CACHE_MS) return rosterCache.list;
  const data = await ragicGet(SHEET.PHOTOGRAPHER);
  const list: Photographer[] = [];
  eachRecord(data, (rec, id) => {
    const p = toPhotographer(rec, id);
    if (p.name) list.push(p);
  });
  list.sort((a, b) => a.id - b.id);
  rosterCache = { at: Date.now(), list };
  return list;
}

function clearRosterCache() {
  rosterCache = null;
}

// 報名表裡「攝影師」欄位有值的報名
async function loadPicks(): Promise<Array<PhotographerPick & { photographer: string; id: string }>> {
  const data = await ragicGet(SHEET.REGISTRATION);
  const picks: Array<PhotographerPick & { photographer: string; id: string }> = [];
  eachRecord(data, (r, id) => {
    const photographer = normalize(r["攝影師"]);
    if (!photographer) return;
    picks.push({
      id,
      photographer,
      playerName: r["選手姓名"] || "",
      eventName: r["賽事名稱"] || "",
      date: r["日期"] || "",
      time: r["時間"] || "",
      itemCategory: r["項目分類"] || "",
      eventItem: r["比賽項目"] || "",
      bibNumber: r["賽事號碼布"] || "",
      school: r["學校"] || "",
      group: normalize(r["組別"]),
    });
  });
  return picks;
}

// ── 查詢 ──────────────────────────────────────────────

export async function listStaffWithCounts(includeInactive: boolean) {
  const [roster, picks] = await Promise.all([loadRoster(), loadPicks()]);
  const today = taipeiToday();
  return roster
    .filter((p) => includeInactive || p.active)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.id - b.id)
    .map((p) => {
      const mine = picks.filter((k) => k.photographer === p.name);
      return {
        ...p,
        pick_count: mine.length,
        upcoming_count: mine.filter((k) => k.date >= today).length,
      };
    });
}

// 前台報名頁用：只回傳可挑選的攝影師（在職、職務為攝影師），只給 id 與名字
export async function listPickablePhotographers(): Promise<Array<{ id: number; name: string }>> {
  return (await loadRoster())
    .filter((p) => p.active && p.role === PICKABLE_ROLE)
    .map(({ id, name }) => ({ id, name }));
}

export async function findPickable(id: number): Promise<Photographer | null> {
  return (await loadRoster()).find((p) => p.id === id && p.active && p.role === PICKABLE_ROLE) ?? null;
}

// 攝影師帳號登入後台：在職、有勾後台權限、Email 相符
export async function findStaffAdmin(email: string): Promise<{ id: number; name: string } | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const p = (await loadRoster()).find((x) => x.active && x.adminAccess && x.email === target);
  return p ? { id: p.id, name: p.name } : null;
}

export async function findStaffAdminById(
  id: number,
): Promise<{ id: number; name: string; email: string; albumAccess: boolean; schoolAccess: boolean } | null> {
  const p = (await loadRoster()).find((x) => x.id === id && x.active && x.adminAccess);
  return p ? { id: p.id, name: p.name, email: p.email, albumAccess: p.albumAccess, schoolAccess: p.schoolAccess } : null;
}

export async function listStaffAdmins(): Promise<Array<Pick<Photographer, "id" | "name" | "role" | "email" | "active">>> {
  return (await loadRoster())
    .filter((p) => p.adminAccess)
    .map(({ id, name, role, email, active }) => ({ id, name, role, email, active }));
}

// 攝影師自己的拍攝行程：報名表裡選了他的報名（依日期時間排序）
export async function listPicksForStaff(id: number): Promise<PhotographerPick[]> {
  const me = (await loadRoster()).find((p) => p.id === id);
  if (!me) return [];
  return (await loadPicks())
    .filter((k) => k.photographer === me.name)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .map(({ playerName, eventName, date, time, itemCategory, eventItem, bibNumber, school, group }) => ({
      playerName, eventName, date, time, itemCategory, eventItem, bibNumber, school, group,
    }));
}

// ── 人員管理 ───────────────────────────────────────────

export interface StaffInput {
  name?: string;
  role?: string;
  phone?: string;
  notes?: string;
  email?: string;
  adminAccess?: boolean;
  albumAccess?: boolean;
  schoolAccess?: boolean;
  active?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkRole(role: string | undefined) {
  if (role && !(STAFF_ROLES as readonly string[]).includes(role)) {
    throw new StaffError(`職務只能是：${STAFF_ROLES.join("、")}`, 400);
  }
}

function checkAlbumField(albumAccess: boolean) {
  if (albumAccess && !PHOTOGRAPHER_FIELD.albumAccess) {
    throw new StaffError("Ragic「攝影師名單」還沒有「相簿權限」欄位，請先新增後再開啟", 400);
  }
}

function checkSchoolField(schoolAccess: boolean) {
  if (schoolAccess && !PHOTOGRAPHER_FIELD.schoolAccess) {
    throw new StaffError("Ragic「攝影師名單」還沒有「學校名單權限」欄位，請先新增後再開啟", 400);
  }
}

function checkEmail(email: string, adminAccess: boolean) {
  if (email && !EMAIL_RE.test(email)) throw new StaffError("Email 格式不正確", 400);
  if (adminAccess && !email) throw new StaffError("要開放後台權限，請填寫這位人員的 Google Email", 400);
}

function toWriteBody(p: Omit<Photographer, "id">): Record<string, string> {
  return {
    [PHOTOGRAPHER_FIELD.name]: p.name,
    [PHOTOGRAPHER_FIELD.role]: p.role,
    [PHOTOGRAPHER_FIELD.phone]: p.phone,
    [PHOTOGRAPHER_FIELD.email]: p.email,
    [PHOTOGRAPHER_FIELD.status]: p.active ? STATUS_ACTIVE : STATUS_INACTIVE,
    [PHOTOGRAPHER_FIELD.adminAccess]: p.adminAccess ? "Yes" : "No",
    [PHOTOGRAPHER_FIELD.notes]: p.notes,
    ...(PHOTOGRAPHER_FIELD.albumAccess ? { [PHOTOGRAPHER_FIELD.albumAccess]: p.albumAccess ? "Yes" : "No" } : {}),
    ...(PHOTOGRAPHER_FIELD.schoolAccess ? { [PHOTOGRAPHER_FIELD.schoolAccess]: p.schoolAccess ? "Yes" : "No" } : {}),
  };
}

export async function createStaff(input: StaffInput): Promise<Photographer> {
  const name = input.name?.trim() ?? "";
  if (!name) throw new StaffError("請填寫名稱", 400);
  const roster = await loadRoster();
  if (roster.some((p) => p.name === name)) throw new StaffError("已有同名人員", 409);
  const p: Omit<Photographer, "id"> = {
    name,
    role: input.role?.trim() || PICKABLE_ROLE,
    phone: input.phone?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    email: input.email?.trim().toLowerCase() ?? "",
    adminAccess: Boolean(input.adminAccess),
    albumAccess: Boolean(input.albumAccess),
    schoolAccess: Boolean(input.schoolAccess),
    active: true,
  };
  checkRole(p.role);
  checkEmail(p.email, p.adminAccess);
  checkAlbumField(p.albumAccess);
  checkSchoolField(p.schoolAccess);
  const result = await ragicPost(SHEET.PHOTOGRAPHER, toWriteBody(p), { strict: true });
  clearRosterCache();
  return { ...p, id: Number(result.ragicId ?? 0) };
}

// 改名時，報名表裡選了舊名字的報名也一起改成新名字（報名表存的是名字）
export async function updateStaff(id: number, input: StaffInput): Promise<{ before: Photographer; after: Photographer }> {
  const roster = await loadRoster();
  const before = roster.find((x) => x.id === id);
  if (!before) throw new StaffError("查無此人員", 404);

  const after: Photographer = { ...before };
  if (input.name !== undefined) {
    after.name = input.name.trim();
    if (!after.name) throw new StaffError("請填寫名稱", 400);
    if (after.name !== before.name && roster.some((x) => x.name === after.name)) {
      throw new StaffError("已有同名人員", 409);
    }
  }
  if (input.role !== undefined) after.role = input.role.trim() || PICKABLE_ROLE;
  if (input.phone !== undefined) after.phone = input.phone.trim();
  if (input.notes !== undefined) after.notes = input.notes.trim();
  if (input.email !== undefined) after.email = input.email.trim().toLowerCase();
  if (input.adminAccess !== undefined) after.adminAccess = Boolean(input.adminAccess);
  if (input.albumAccess !== undefined) after.albumAccess = Boolean(input.albumAccess);
  if (input.schoolAccess !== undefined) after.schoolAccess = Boolean(input.schoolAccess);
  if (input.active !== undefined) after.active = Boolean(input.active);
  checkRole(input.role !== undefined ? after.role : undefined);
  checkEmail(after.email, after.adminAccess);
  if (input.albumAccess !== undefined) checkAlbumField(after.albumAccess);
  if (input.schoolAccess !== undefined) checkSchoolField(after.schoolAccess);

  const { id: _id, ...fields } = after;
  void _id;
  await ragicPost(`${SHEET.PHOTOGRAPHER}/${id}`, toWriteBody(fields), { strict: true });
  clearRosterCache();

  if (after.name !== before.name && REGISTRATION_FIELD.photographer) {
    for (const k of (await loadPicks()).filter((x) => x.photographer === before.name)) {
      await ragicPost(`${SHEET.REGISTRATION}/${k.id}`, { [REGISTRATION_FIELD.photographer]: after.name }, { strict: true });
    }
  }
  return { before, after };
}

export async function deleteStaff(id: number): Promise<Photographer> {
  const p = (await loadRoster()).find((x) => x.id === id);
  if (!p) throw new StaffError("查無此人員", 404);
  if ((await loadPicks()).some((k) => k.photographer === p.name)) {
    throw new StaffError("這位人員已被選手選過，請改用停用", 409);
  }
  await ragicDelete(`${SHEET.PHOTOGRAPHER}/${id}`);
  clearRosterCache();
  return p;
}
