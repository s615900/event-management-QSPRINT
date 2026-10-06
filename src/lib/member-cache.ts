"use client";

// 瀏覽器端快取（沿用原專案的 localStorage key，舊使用者升級後不用重新登入）
export type MemberInfo = {
  playerName?: string;
  group?: string;
  school?: string;
  email?: string;
  phone?: string;
  ig?: string;
  lineName?: string;
  accountStatus?: string;
};

function get(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export const cache = { get, set };

export function readCachedMember(): MemberInfo {
  return {
    playerName: get("memberName"),
    group: get("memberGroup"),
    school: get("memberSchool"),
    email: get("memberEmail"),
    phone: get("memberPhone"),
    ig: get("memberIG"),
    lineName: get("lineName"),
  };
}

export function saveMember(m: MemberInfo) {
  set("memberName", m.playerName || "");
  set("memberGroup", m.group || "");
  set("memberSchool", m.school || "");
  set("memberEmail", m.email || "");
  set("memberPhone", m.phone || "");
  set("memberIG", m.ig || "");
  set("isMember", "true");
}

export function clearAll() {
  try {
    localStorage.clear();
  } catch {}
}
