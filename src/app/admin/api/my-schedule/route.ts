import { adminRoute } from "@/server/admin/route";
import { listPicksForStaff } from "@/server/photographers";
import { taipeiToday } from "@/server/dates";

// 攝影師自己的拍攝行程：被選手選擇的紀錄。管理員帳號沒有對應的攝影師，回傳空清單。
export const GET = adminRoute(
  "讀取拍攝行程失敗",
  async (_req, session) => {
    const items = session.role === "staff" && session.staffId ? await listPicksForStaff(session.staffId) : [];
    return Response.json({
      name: session.name,
      isStaff: session.role === "staff",
      today: taipeiToday(),
      items: items.map(({ playerName, eventName, date, time, itemCategory, eventItem, bibNumber }) => ({
        playerName, eventName, date, time, itemCategory, eventItem, bibNumber,
      })),
    });
  },
  { allowStaff: true },
);
