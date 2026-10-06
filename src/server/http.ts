import "server-only";

export function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

// 統一的錯誤處理：記錄 log，回傳 500 + 錯誤訊息（同原 Express 各 route 的 catch 區塊）
export function serverError(err: unknown, label: string) {
  console.error(`[${label}]`, err);
  return jsonError((err as Error).message ?? String(err), 500);
}

export async function readBody(req: Request): Promise<Record<string, string>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function intParam(v: string | null, fallback: number) {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}
