import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { taipeiToday } from "./dates";

// 攝影師名單與選手的攝影師選擇（參考 studio-nextjs 的人員管理）。
// 目前存在本機 data/photographers.json；Ragic 沒有對應表單，部署到 Vercel 前要換成 Ragic 或資料庫，
// 屆時只需改寫這個檔案的 load/save。

export const STAFF_ROLES = ["攝影師", "小編"] as const;
// 選手報名時能挑的只有「在職」且職務是攝影師的人
export const PICKABLE_ROLE = "攝影師";

export interface Photographer {
  id: number;
  name: string; // 報名頁會顯示這個名字
  role: string;
  phone: string;
  notes: string;
  email: string; // Google 帳號，勾選「後台權限」時用來登入後台
  adminAccess: boolean; // 可以登入後台
  active: boolean;
  createdAt: string;
}

// 選手報名時選的攝影師。Ragic 報名表沒有攝影師欄位，所以另外記一筆，
// 用（LINE userId、賽事、日期、時間、號碼布）對應回 Ragic 的報名記錄。
export interface PhotographerPick {
  photographerId: number;
  lineUserId: string;
  playerName: string;
  eventName: string;
  date: string;
  time: string;
  itemCategory: string;
  eventItem: string;
  bibNumber: string;
  createdAt: string;
}

interface Store {
  photographers: Photographer[];
  picks: PhotographerPick[];
}

const STORE_PATH = path.join(process.cwd(), "data", "photographers.json");

async function load(): Promise<Store> {
  try {
    const data = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as Partial<Store>;
    // 舊資料沒有 email / adminAccess 欄位，補上預設值
    const photographers = (data.photographers ?? []).map((p) => ({ ...p, email: p.email ?? "", adminAccess: p.adminAccess ?? false }));
    return { photographers, picks: data.picks ?? [] };
  } catch {
    return { photographers: [], picks: [] };
  }
}

async function save(store: Store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

// 寫入排隊，避免兩個請求同時寫檔互相覆蓋
let queue: Promise<unknown> = Promise.resolve();
function update<T>(fn: (store: Store) => T): Promise<T> {
  const run = queue.then(async () => {
    const store = await load();
    const result = fn(store);
    await save(store);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export class StaffError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type PickKey = Pick<PhotographerPick, "lineUserId" | "eventName" | "date" | "time" | "bibNumber">;
export function pickKey(k: PickKey): string {
  return [k.lineUserId, k.eventName, k.date, k.time, k.bibNumber].map((v) => (v ?? "").trim()).join("\x00");
}

// ── 查詢 ──────────────────────────────────────────────

export async function listStaffWithCounts(includeInactive: boolean) {
  const { photographers, picks } = await load();
  const today = taipeiToday();
  return photographers
    .filter((p) => includeInactive || p.active)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.id - b.id)
    .map((p) => {
      const mine = picks.filter((k) => k.photographerId === p.id);
      return {
        ...p,
        pick_count: mine.length,
        upcoming_count: mine.filter((k) => k.date >= today).length,
      };
    });
}

// 前台報名頁用：只回傳可挑選的攝影師（在職、職務為攝影師），只給 id 與名字
export async function listPickablePhotographers(): Promise<Array<{ id: number; name: string }>> {
  const { photographers } = await load();
  return photographers
    .filter((p) => p.active && p.role === PICKABLE_ROLE)
    .sort((a, b) => a.id - b.id)
    .map(({ id, name }) => ({ id, name }));
}

export async function findPickable(id: number): Promise<Photographer | null> {
  const { photographers } = await load();
  return photographers.find((p) => p.id === id && p.active && p.role === PICKABLE_ROLE) ?? null;
}

// 回傳「報名記錄 key → 攝影師名字」對照表，給報名列表、報名紀錄顯示用
export async function photographerNameByPickKey(): Promise<Map<string, string>> {
  const { photographers, picks } = await load();
  const names = new Map(photographers.map((p) => [p.id, p.name]));
  return new Map(picks.map((k) => [pickKey(k), names.get(k.photographerId) ?? ""]));
}

// 攝影師帳號登入後台：在職、有勾後台權限、Email 相符
export async function findStaffAdmin(email: string): Promise<{ id: number; name: string } | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const { photographers } = await load();
  const p = photographers.find((x) => x.active && x.adminAccess && x.email.trim().toLowerCase() === target);
  return p ? { id: p.id, name: p.name } : null;
}

export async function findStaffAdminById(id: number): Promise<{ id: number; name: string; email: string } | null> {
  const { photographers } = await load();
  const p = photographers.find((x) => x.id === id && x.active && x.adminAccess);
  return p ? { id: p.id, name: p.name, email: p.email.trim().toLowerCase() } : null;
}

// 攝影師自己的拍攝行程：被選手選擇的紀錄（依日期時間排序）
export async function listPicksForStaff(id: number): Promise<PhotographerPick[]> {
  const { picks } = await load();
  return picks
    .filter((k) => k.photographerId === id)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export async function listStaffAdmins(): Promise<Array<Pick<Photographer, "id" | "name" | "role" | "email" | "active">>> {
  const { photographers } = await load();
  return photographers
    .filter((p) => p.adminAccess)
    .map(({ id, name, role, email, active }) => ({ id, name, role, email, active }));
}

// ── 人員管理 ───────────────────────────────────────────

export interface StaffInput {
  name?: string;
  role?: string;
  phone?: string;
  notes?: string;
  email?: string;
  adminAccess?: boolean;
  active?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkRole(role: string | undefined) {
  if (role && !(STAFF_ROLES as readonly string[]).includes(role)) {
    throw new StaffError(`職務只能是：${STAFF_ROLES.join("、")}`, 400);
  }
}

function checkEmail(email: string, adminAccess: boolean) {
  if (email && !EMAIL_RE.test(email)) throw new StaffError("Email 格式不正確", 400);
  if (adminAccess && !email) throw new StaffError("要開放後台權限，請填寫這位人員的 Google Email", 400);
}

function clean(input: StaffInput) {
  return {
    name: input.name?.trim(),
    role: input.role?.trim() || undefined,
    phone: input.phone?.trim(),
    notes: input.notes?.trim(),
    email: input.email?.trim().toLowerCase(),
  };
}

export function createStaff(input: StaffInput): Promise<Photographer> {
  const c = clean(input);
  if (!c.name) return Promise.reject(new StaffError("請填寫名稱", 400));
  return update((store) => {
    if (store.photographers.some((p) => p.name === c.name)) throw new StaffError("已有同名人員", 409);
    checkRole(c.role);
    checkEmail(c.email ?? "", Boolean(input.adminAccess));
    const p: Photographer = {
      id: Math.max(0, ...store.photographers.map((x) => x.id)) + 1,
      name: c.name!,
      role: c.role || PICKABLE_ROLE,
      phone: c.phone ?? "",
      notes: c.notes ?? "",
      email: c.email ?? "",
      adminAccess: Boolean(input.adminAccess),
      active: true,
      createdAt: new Date().toISOString(),
    };
    store.photographers.push(p);
    return p;
  });
}

// 回傳修改前後，給操作紀錄用。選擇紀錄存的是攝影師 id，改名後自動顯示新名字。
export function updateStaff(id: number, input: StaffInput): Promise<{ before: Photographer; after: Photographer }> {
  const c = clean(input);
  if (input.name !== undefined && !c.name) return Promise.reject(new StaffError("請填寫名稱", 400));
  return update((store) => {
    const p = store.photographers.find((x) => x.id === id);
    if (!p) throw new StaffError("查無此人員", 404);
    if (c.name && c.name !== p.name && store.photographers.some((x) => x.name === c.name)) {
      throw new StaffError("已有同名人員", 409);
    }
    checkRole(c.role);
    const before = { ...p };
    if (c.name) p.name = c.name;
    if (input.role !== undefined) p.role = c.role || PICKABLE_ROLE;
    if (input.phone !== undefined) p.phone = c.phone ?? "";
    if (input.notes !== undefined) p.notes = c.notes ?? "";
    if (input.email !== undefined) p.email = c.email ?? "";
    if (input.adminAccess !== undefined) p.adminAccess = Boolean(input.adminAccess);
    if (input.active !== undefined) p.active = Boolean(input.active);
    checkEmail(p.email, p.adminAccess);
    return { before, after: { ...p } };
  });
}

export function deleteStaff(id: number): Promise<Photographer> {
  return update((store) => {
    const p = store.photographers.find((x) => x.id === id);
    if (!p) throw new StaffError("查無此人員", 404);
    if (store.picks.some((k) => k.photographerId === id)) {
      throw new StaffError("這位人員已被選手選過，請改用停用", 409);
    }
    store.photographers = store.photographers.filter((x) => x.id !== id);
    return p;
  });
}

// ── 選手的選擇 ─────────────────────────────────────────

export function recordPick(pick: Omit<PhotographerPick, "createdAt">): Promise<void> {
  return update((store) => {
    const key = pickKey(pick);
    store.picks = store.picks.filter((k) => pickKey(k) !== key);
    store.picks.push({ ...pick, createdAt: new Date().toISOString() });
  });
}

// 後台改了報名記錄的對應欄位 → 把選擇紀錄一起改；刪除報名 → 一起刪除
export function rekeyPick(oldKey: PickKey, next: Partial<PhotographerPick>): Promise<void> {
  return update((store) => {
    const key = pickKey(oldKey);
    const k = store.picks.find((x) => pickKey(x) === key);
    if (k) Object.assign(k, next);
  });
}

export function removePick(oldKey: PickKey): Promise<void> {
  return update((store) => {
    const key = pickKey(oldKey);
    store.picks = store.picks.filter((k) => pickKey(k) !== key);
  });
}
