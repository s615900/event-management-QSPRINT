export type ViewKey = "dashboard" | "weekly-events" | "members" | "registrations" | "event-master" | "albums" | "photographers" | "admins" | "my-schedule";

export const VIEW_TITLES: Record<ViewKey, string> = {
  dashboard: "儀表板",
  "weekly-events": "本週賽事",
  members: "選手管理",
  registrations: "賽事報名資料",
  "event-master": "賽事資訊總表",
  albums: "相簿管理",
  photographers: "攝影師管理",
  admins: "管理員權限",
  "my-schedule": "我的拍攝行程",
};

// 每個頁面對應的網址
export const VIEW_TO_PATH: Record<ViewKey, string> = {
  dashboard: "/admin",
  "weekly-events": "/admin/weekly-events",
  members: "/admin/members",
  registrations: "/admin/registrations",
  "event-master": "/admin/event-master",
  albums: "/admin/albums",
  photographers: "/admin/photographers",
  admins: "/admin/admins",
  "my-schedule": "/admin/my-schedule",
};

export const PATH_TO_VIEW: Record<string, ViewKey> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view as ViewKey]),
);
