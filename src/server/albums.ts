import "server-only";
import { ALBUM_FIELD, eachRecord, normalize, ragicDelete, ragicGet, ragicPost, RAGIC_YES, SHEET } from "./ragic";
import { parseDateLoose } from "./dates";
import { multicastText } from "./line";
import { LIFF_ID } from "@/lib/liff-id";

// 賽事相簿：一場賽事＋一位攝影師＝一個雲端資料夾（Ragic「賽事相簿連結」表）。
// 選手看得到的是：自己報名、且選了該攝影師的賽事相簿。

export interface Album {
  id: string; // Ragic 記錄 ID
  eventName: string;
  photographer: string;
  albumUrl: string;
  isOpen: boolean;
}

export class AlbumError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function albumFieldReady(): boolean {
  return Boolean(ALBUM_FIELD.photographer);
}

export async function loadAlbums(): Promise<Album[]> {
  const data = await ragicGet(SHEET.ALBUM);
  const list: Album[] = [];
  eachRecord(data, (r, id) => {
    const eventName = normalize(r["賽事名稱"]);
    const photographer = normalize(r["攝影師"]);
    if (!eventName || !photographer) return; // 舊版依學校分的相簿沒有攝影師，不再使用
    list.push({
      id,
      eventName,
      photographer,
      albumUrl: normalize(r["Google雲端連結"]),
      isOpen: r["是否開放相簿"] === RAGIC_YES,
    });
  });
  return list;
}

// 報名表裡「賽事 → 攝影師 → 選了他的選手」
type PickIndex = Map<string, { firstDate: string; byPhotographer: Map<string, { count: number; lineUserIds: Set<string> }> }>;

async function loadPickIndex(): Promise<PickIndex> {
  const data = await ragicGet(SHEET.REGISTRATION);
  const index: PickIndex = new Map();
  eachRecord(data, (r) => {
    const eventName = normalize(r["賽事名稱"]);
    const photographer = normalize(r["攝影師"]);
    if (!eventName || !photographer) return;
    const date = parseDateLoose(r["日期"]) || "";
    if (!index.has(eventName)) index.set(eventName, { firstDate: date, byPhotographer: new Map() });
    const ev = index.get(eventName)!;
    if (date && (!ev.firstDate || date < ev.firstDate)) ev.firstDate = date;
    if (!ev.byPhotographer.has(photographer)) ev.byPhotographer.set(photographer, { count: 0, lineUserIds: new Set() });
    const p = ev.byPhotographer.get(photographer)!;
    p.count += 1;
    const uid = normalize(r["LINE user ID"]);
    if (uid) p.lineUserIds.add(uid);
  });
  return index;
}

export interface AlbumRow {
  eventName: string;
  photographer: string;
  athleteCount: number; // 選了這位攝影師的報名筆數
  album: Album | null; // 還沒建立相簿時為 null
}

/**
 * 相簿管理總覽。onlyPhotographer：攝影師帳號只看得到自己的相簿。
 * events：有選手選了攝影師的賽事（新的在前）；rows：選定賽事裡每位攝影師一列。
 */
export async function albumOverview(eventName: string | null, onlyPhotographer: string | null) {
  const [albums, picks] = await Promise.all([loadAlbums(), loadPickIndex()]);
  const mine = (photographer: string) => !onlyPhotographer || photographer === onlyPhotographer;

  const eventNames = new Set<string>();
  for (const [ev, info] of picks) if ([...info.byPhotographer.keys()].some(mine)) eventNames.add(ev);
  for (const a of albums) if (mine(a.photographer)) eventNames.add(a.eventName);

  const events = [...eventNames]
    .map((name) => {
      const info = picks.get(name);
      const photographers = new Set([
        ...[...(info?.byPhotographer.keys() ?? [])].filter(mine),
        ...albums.filter((a) => a.eventName === name && mine(a.photographer)).map((a) => a.photographer),
      ]);
      const evAlbums = albums.filter((a) => a.eventName === name && mine(a.photographer));
      return {
        eventName: name,
        date: info?.firstDate ?? "",
        photographerCount: photographers.size,
        openCount: evAlbums.filter((a) => a.isOpen).length,
        missingCount: [...photographers].filter((p) => !evAlbums.some((a) => a.photographer === p && a.albumUrl)).length,
      };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.eventName.localeCompare(b.eventName, "zh-TW"));

  const selected = eventName && eventNames.has(eventName) ? eventName : events[0]?.eventName ?? null;
  const rows: AlbumRow[] = [];
  if (selected) {
    const info = picks.get(selected);
    const names = new Set([
      ...[...(info?.byPhotographer.keys() ?? [])].filter(mine),
      ...albums.filter((a) => a.eventName === selected && mine(a.photographer)).map((a) => a.photographer),
    ]);
    for (const photographer of names) {
      rows.push({
        eventName: selected,
        photographer,
        athleteCount: info?.byPhotographer.get(photographer)?.count ?? 0,
        album: albums.find((a) => a.eventName === selected && a.photographer === photographer) ?? null,
      });
    }
    rows.sort((a, b) => a.photographer.localeCompare(b.photographer, "zh-TW"));
  }
  return { events, selected, rows };
}

function checkUrl(url: string) {
  if (!url) return;
  if (!/^https:\/\/\S+$/.test(url)) throw new AlbumError("相簿連結要是 https:// 開頭的網址", 400);
}

// 新增或更新「賽事＋攝影師」的相簿。回傳更新後的相簿與是否從未開放變成開放
export async function saveAlbum(input: {
  eventName: string;
  photographer: string;
  albumUrl?: string;
  isOpen?: boolean;
}): Promise<{ album: Album; before: Album | null; becameOpen: boolean }> {
  if (!albumFieldReady()) throw new AlbumError("Ragic「賽事相簿連結」表還沒有「攝影師」欄位，請先新增", 400);
  const eventName = normalize(input.eventName);
  const photographer = normalize(input.photographer);
  if (!eventName || !photographer) throw new AlbumError("缺少賽事或攝影師", 400);

  const before = (await loadAlbums()).find((a) => a.eventName === eventName && a.photographer === photographer) ?? null;
  const albumUrl = input.albumUrl !== undefined ? normalize(input.albumUrl) : before?.albumUrl ?? "";
  const isOpen = input.isOpen !== undefined ? Boolean(input.isOpen) : before?.isOpen ?? false;
  checkUrl(albumUrl);
  if (isOpen && !albumUrl) throw new AlbumError("請先貼上相簿連結才能開放", 400);

  const body = {
    [ALBUM_FIELD.eventName]: eventName,
    [ALBUM_FIELD.photographer]: photographer,
    [ALBUM_FIELD.albumUrl]: albumUrl,
    [ALBUM_FIELD.isOpen]: isOpen ? "Yes" : "No",
  };
  let id = before?.id;
  if (id !== undefined) {
    await ragicPost(`${SHEET.ALBUM}/${id}`, body, { strict: true });
  } else {
    const result = await ragicPost(SHEET.ALBUM, body, { strict: true });
    id = String(result.ragicId ?? "");
  }
  return {
    album: { id: id ?? "", eventName, photographer, albumUrl, isOpen },
    before,
    becameOpen: isOpen && !before?.isOpen,
  };
}

export async function deleteAlbum(id: string, onlyPhotographer: string | null): Promise<Album> {
  const album = (await loadAlbums()).find((a) => a.id === id);
  if (!album) throw new AlbumError("查無此相簿", 404);
  if (onlyPhotographer && album.photographer !== onlyPhotographer) throw new AlbumError("只能刪除自己的相簿", 403);
  await ragicDelete(`${SHEET.ALBUM}/${id}`);
  return album;
}

// 通知這場賽事選了這位攝影師的選手：相簿已開放。回傳通知人數
export async function notifyAlbumOpen(eventName: string, photographer: string): Promise<number> {
  const info = (await loadPickIndex()).get(eventName)?.byPhotographer.get(photographer);
  const ids = [...(info?.lineUserIds ?? [])];
  if (ids.length === 0) return 0;
  const albumPage = `https://liff.line.me/${LIFF_ID}/album`;
  return multicastText(
    ids,
    `📂 你的賽事相簿已開放！\n\n賽事：${eventName}\n攝影師：${photographer}\n\n點這裡查看相簿：\n${albumPage}`,
  );
}
