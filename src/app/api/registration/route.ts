import { after } from "next/server";
import { requireLineIdentity, sendRegistrationNotification } from "@/server/line";
import {
  countRegistrationsForDate,
  findEventRecordByName,
  findJustCreatedRegistrationId,
  parseDailySchedule,
  uploadLinePictureToRagic,
} from "@/server/qsprint";
import { ragicPost, REGISTRATION_FIELD, SHEET } from "@/server/ragic";
import { parseEventDateRange } from "@/server/dates";
import { findPickable, listPickablePhotographers } from "@/server/photographers";
import { readBody, serverError } from "@/server/http";

// 送出賽事報名（寫入用數字欄位代碼）；lineUserId 一律採用 LIFF 驗證出的真實身分
export async function POST(req: Request) {
  const auth = await requireLineIdentity(req);
  if ("response" in auth) return auth.response;
  try {
    const {
      lineName, playerName, group, school, email, ig,
      eventName, bibNumber, date, time, itemCategory, eventItem, pictureUrl, photographerId,
    } = await readBody(req);
    const lineUserId = auth.lineUserId;

    // 選手挑的攝影師；只接受目前在職、職務為攝影師的人。名單上有人可選時一定要選一位。
    // 注意：Ragic 記錄編號可能是 0，不能用「有沒有值」判斷是否有選
    const pickedRaw = String(photographerId ?? "").trim();
    const pickedId = pickedRaw === "" ? null : Number(pickedRaw);
    const photographer = pickedId !== null && Number.isInteger(pickedId) ? await findPickable(pickedId) : null;
    if (pickedRaw === "" && REGISTRATION_FIELD.photographer && (await listPickablePhotographers()).length > 0) {
      return Response.json({ success: false, error: "請選擇攝影師" }, { status: 400 });
    }
    if (pickedRaw !== "" && !photographer) {
      return Response.json(
        { success: false, error: "您選的攝影師目前無法選擇，請重新整理後再選一次" },
        { status: 400 },
      );
    }

    // 選手號碼只能是 4 位數字（前端已限制，後端再擋一次）
    if (!/^\d{4}$/.test(String(bibNumber ?? "").trim())) {
      return Response.json({ success: false, error: "選手號碼請輸入 4 位數字" }, { status: 400 });
    }

    // 後端再次驗證日期是否落在賽事區間（前端只是體驗，防止繞過）
    const range = parseEventDateRange(eventName || "");
    if (range && date && (date < range.start || date > range.end)) {
      return Response.json(
        { success: false, error: `比賽日期需在 ${range.start} ～ ${range.end} 之間` },
        { status: 400 },
      );
    }

    // 寫入前最後一刻重新查一次該賽事＋該日期的報名筆數，防止額滿邊界同時送出造成超收。
    // 只有設定了「賽事每日場次」的賽事才做這層檢查。
    if (eventName && date) {
      const eventRecord = await findEventRecordByName(eventName);
      const scheduleRow = eventRecord ? parseDailySchedule(eventRecord).find((r) => r.date === date) : null;
      if (scheduleRow) {
        const registered = await countRegistrationsForDate(eventName, date);
        if (registered >= scheduleRow.capacity) {
          return Response.json(
            { success: false, error: "此日期已額滿，請重新整理選擇其他日期" },
            { status: 400 },
          );
        }
      }
    }

    const result = await ragicPost(SHEET.REGISTRATION, {
      [REGISTRATION_FIELD.lineUserId]: lineUserId,
      [REGISTRATION_FIELD.lineName]: lineName,
      [REGISTRATION_FIELD.playerName]: playerName,
      [REGISTRATION_FIELD.group]: group,
      [REGISTRATION_FIELD.school]: school,
      [REGISTRATION_FIELD.email]: email,
      [REGISTRATION_FIELD.ig]: ig || "",
      [REGISTRATION_FIELD.eventName]: eventName,
      [REGISTRATION_FIELD.date]: date,
      [REGISTRATION_FIELD.time]: time,
      [REGISTRATION_FIELD.itemCategory]: itemCategory,
      [REGISTRATION_FIELD.eventItem]: eventItem,
      [REGISTRATION_FIELD.bibNumber]: bibNumber,
      ...(photographer && REGISTRATION_FIELD.photographer ? { [REGISTRATION_FIELD.photographer]: photographer.name } : {}),
    });

    // 回應送出後才執行：上傳 LINE 大頭照到報名表、推播報名成功通知（皆不影響報名結果）
    after(async () => {
      let ragicId = result.ragicId as string | number | undefined;
      if (!ragicId && pictureUrl) {
        ragicId = await findJustCreatedRegistrationId({ lineUserId, eventName, date, time, bibNumber });
      }
      await uploadLinePictureToRagic(SHEET.REGISTRATION, ragicId, REGISTRATION_FIELD.picture, pictureUrl);
    });
    after(() =>
      sendRegistrationNotification(lineUserId, {
        playerName, eventName, itemCategory, eventItem, date, time, bibNumber,
        photographer: photographer?.name ?? "",
      }),
    );

    return Response.json({ success: true, result });
  } catch (err) {
    return serverError(err, "送出報名失敗");
  }
}
