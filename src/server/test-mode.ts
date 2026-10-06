import "server-only";

// 本機測試模式：.env.local 設 AUTH_TEST_MODE=1 且不是正式環境才會開啟。
// 開啟時：後台可用「本機測試登入」、前台可略過 LINE 登入、沒填 Ragic 金鑰時改用本機假資料。
export function isAuthTestMode(): boolean {
  return process.env.AUTH_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
}

// 略過 LINE 時前端送來的假 ID Token，以及對應的測試選手（"test-" 開頭不會觸發 LINE 推播）
export const TEST_LINE_ID_TOKEN = "test-mode";
export const TEST_LINE_USER_ID = "test-user-001";

// 沒有 Ragic 金鑰時，測試模式改用本機假資料
export function isFakeRagic(): boolean {
  return isAuthTestMode() && !process.env.RAGIC_API_KEY;
}
