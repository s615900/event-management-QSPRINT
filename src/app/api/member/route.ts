import { after } from "next/server";
import { requireLineIdentity } from "@/server/line";
import { findMemberRecord, uploadLinePictureToRagic } from "@/server/qsprint";
import { MEMBER_FIELD, ragicPost, SHEET } from "@/server/ragic";
import { readBody, serverError } from "@/server/http";

// 新增／更新會員資料（寫入用數字欄位代碼）
// lineUserId 一律採用 LIFF ID Token 驗證出的真實身分，完全忽略 body 裡的 lineUserId（防帳號接管）。
export async function POST(req: Request) {
  const auth = await requireLineIdentity(req);
  if ("response" in auth) return auth.response;
  try {
    const { lineName, playerName, group, school, phone, email, ig, pictureUrl } = await readBody(req);
    const lineUserId = auth.lineUserId;
    // 已有舊記錄（不論帳號狀態啟用／停用）→ 更新舊記錄並重新啟用；查無記錄 → 建立新記錄
    const existing = await findMemberRecord(lineUserId);
    const body = {
      [MEMBER_FIELD.playerName]: playerName,
      [MEMBER_FIELD.group]: group,
      [MEMBER_FIELD.school]: school,
      [MEMBER_FIELD.phone]: phone,
      [MEMBER_FIELD.email]: email,
      [MEMBER_FIELD.ig]: ig || "",
      [MEMBER_FIELD.lineName]: lineName,
      [MEMBER_FIELD.lineUserId]: lineUserId,
      [MEMBER_FIELD.accountStatus]: "啟用",
    };
    const result = existing
      ? await ragicPost(`${SHEET.MEMBER}/${existing._recordId}`, body)
      : await ragicPost(SHEET.MEMBER, body);
    const ragicId = (result.ragicId as string | number | undefined) ?? existing?._recordId;

    // 把 LINE 大頭照帶入「上傳圖片（認臉時確認）」欄位；回應送出後才執行，失敗不影響登錄結果
    after(() => uploadLinePictureToRagic(SHEET.MEMBER, ragicId, MEMBER_FIELD.picture, pictureUrl));

    return Response.json({ success: true, result });
  } catch (err) {
    return serverError(err, "新增／更新會員失敗");
  }
}
