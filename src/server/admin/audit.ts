import "server-only";
import { AUDIT_LOG_FIELD, ragicPost, SHEET } from "../ragic";
import { formatRagicTimestamp } from "../dates";
import type { AdminSession } from "./session";

export type AuditActionType = "新增" | "編輯" | "刪除" | "開關切換";

// 寫入 Ragic 操作紀錄表；寫入失敗只記錄錯誤，不擋住主要操作
export async function writeAuditLog(
  session: AdminSession,
  actionType: AuditActionType,
  targetDescription: string, // 例如「賽事報名表 - 王小明」
  changeSummary: string, // 例如「學校從 A 改為 B」
): Promise<void> {
  try {
    await ragicPost(
      SHEET.AUDIT_LOG,
      {
        [AUDIT_LOG_FIELD.timestamp]: formatRagicTimestamp(new Date()),
        [AUDIT_LOG_FIELD.operatorName]: session.name || "unknown",
        [AUDIT_LOG_FIELD.operatorEmail]: session.email || "unknown",
        [AUDIT_LOG_FIELD.actionType]: actionType,
        [AUDIT_LOG_FIELD.targetDescription]: targetDescription,
        [AUDIT_LOG_FIELD.changeSummary]: changeSummary,
      },
      { strict: true },
    );
  } catch (err) {
    console.error("寫入操作紀錄表失敗", { actionType, targetDescription, err });
  }
}

// 比對「可編輯欄位」的新舊值，組出要寫入 Ragic 的 body 與變更說明
export function diffFields(
  before: Record<string, string>,
  body: Record<string, unknown>,
  fields: Array<{ key: string; fieldId: string; label: string; ragicKey: string; transform?: (v: string) => string }>,
  normalize: (s: string) => string,
): { writeBody: Record<string, string>; changes: string[] } {
  const writeBody: Record<string, string> = {};
  const changes: string[] = [];
  for (const f of fields) {
    if (!(f.key in body)) continue;
    const raw = String(body[f.key] ?? "");
    const newValue = f.transform ? f.transform(raw) : raw;
    const oldValue = before[f.ragicKey] || "";
    if (normalize(newValue) === normalize(oldValue)) continue;
    writeBody[f.fieldId] = newValue;
    changes.push(`${f.label}：「${oldValue}」→「${newValue}」`);
  }
  return { writeBody, changes };
}
