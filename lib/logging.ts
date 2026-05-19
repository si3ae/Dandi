/**
 * 사용 로그 + 오류 신고 클라이언트 헬퍼
 *
 * 모든 API 호출은 fire-and-forget (실패해도 앱 동작에 영향 없음)
 */

import { getDeviceId } from "./sync";

async function sendLog(body: any) {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId(), ...body }),
    });
  } catch {
    // 오프라인 or DB 미설정 → 무시
  }
}

/** 음성/OCR 입력 시 자동 호출 — 반환값: logId (오류 신고 시 연결용) */
export async function logUsage(params: {
  source: "voice" | "handwriting" | "receipt" | "taxinvoice";
  whisperText?: string;
  parsedJson?: any;
  cacheAction?: "hit" | "miss" | "none";
  cacheMatchedAccount?: string;
  durationMs?: number;
  model?: string;
  success?: boolean;
  errorMessage?: string;
}): Promise<string | null> {
  try {
    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        action: "usage",
        ...params,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.logId || null;
    }
  } catch {}
  return null;
}

/** 사용자가 오류 신고할 때 호출 */
export async function reportError(params: {
  usageLogId?: string | null;
  entryId?: string;
  reportType: "wrong_account" | "wrong_amount" | "wrong_vendor" | "wrong_type" | "other";
  originalValue?: string;
  correctedValue?: string;
  description?: string;
}) {
  return sendLog({ action: "error_report", ...params });
}
