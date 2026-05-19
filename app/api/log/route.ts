import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/log
 *
 * body.action: "usage" | "error_report"
 *
 * usage: 음성/OCR 입력 시 자동 기록
 * {
 *   action: "usage",
 *   deviceId, source, whisperText, parsedJson,
 *   cacheAction, cacheMatchedAccount, durationMs, model,
 *   success, errorMessage
 * }
 *
 * error_report: 사용자가 오류 신고
 * {
 *   action: "error_report",
 *   deviceId, usageLogId?, entryId, reportType,
 *   originalValue, correctedValue, description
 * }
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    // DB 미설정 시 조용히 무시 (로컬 개발)
    return NextResponse.json({ ok: true, stored: false });
  }

  try {
    const body = await req.json();
    const { action, deviceId } = body;

    if (!deviceId || !action) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    if (action === "usage") {
      // 민감 정보 마스킹 (카드번호, 주민번호 등)
      const maskedText = maskSensitive(body.whisperText || "");

      const { data, error } = await supabase.from("usage_logs").insert({
        device_id: deviceId,
        source: body.source || "unknown",
        whisper_text: maskedText || null,
        parsed_json: body.parsedJson || null,
        cache_action: body.cacheAction || "none",
        cache_matched_account: body.cacheMatchedAccount || null,
        duration_ms: body.durationMs || null,
        model: body.model || null,
        success: body.success !== false,
        error_message: body.errorMessage || null,
      }).select("id").single();

      if (error) throw error;
      return NextResponse.json({ ok: true, logId: data?.id });
    }

    if (action === "error_report") {
      const { error } = await supabase.from("error_reports").insert({
        device_id: deviceId,
        usage_log_id: body.usageLogId || null,
        entry_id: body.entryId || null,
        report_type: body.reportType || "other",
        original_value: body.originalValue || null,
        corrected_value: body.correctedValue || null,
        description: body.description || null,
      });

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "잘못된 action" }, { status: 400 });
  } catch (e: any) {
    console.error("[log] error:", e);
    return NextResponse.json({ error: "로그 저장 실패" }, { status: 500 });
  }
}

/** 카드번호·주민번호·계좌번호 패턴 마스킹 */
function maskSensitive(text: string): string {
  if (!text) return text;
  return text
    // 카드번호 (4자리-4자리-4자리-4자리 또는 연속 16자리)
    .replace(/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, "****-****-****-****")
    // 주민번호 (6자리-7자리)
    .replace(/\d{6}[-\s]?\d{7}/g, "******-*******")
    // 계좌번호 패턴 (10~14자리 연속 숫자)
    .replace(/\d{10,14}/g, (m) => m.slice(0, 3) + "*".repeat(m.length - 6) + m.slice(-3));
}
