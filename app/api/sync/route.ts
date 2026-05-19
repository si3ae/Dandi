import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/sync
 *
 * body: {
 *   deviceId: string,
 *   action: "pull" | "push" | "delete",
 *   table: "entries" | "vendors" | "settings",
 *   data?: any[]  (push 시)
 *   ids?: string[] (delete 시)
 * }
 *
 * deviceId는 클라이언트에서 crypto.randomUUID()로 최초 생성 후 localStorage에 저장.
 * 사용자 계정 없이 기기 단위로 데이터 격리.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { deviceId, action, table, data, ids } = body;

    if (!deviceId || !action || !table) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    if (!["entries", "vendors", "settings"].includes(table)) {
      return NextResponse.json({ error: "잘못된 테이블" }, { status: 400 });
    }

    // ── PULL: 서버 → 클라이언트 ──
    if (action === "pull") {
      if (table === "settings") {
        const { data: row, error } = await supabase
          .from("settings")
          .select("data")
          .eq("device_id", deviceId)
          .maybeSingle();
        if (error) throw error;
        return NextResponse.json({ data: row?.data || null });
      }

      const { data: rows, error } = await supabase
        .from(table)
        .select("*")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // DB 컬럼명 → 클라이언트 camelCase 변환
      const mapped = (rows || []).map(dbToClient);
      return NextResponse.json({ data: mapped });
    }

    // ── PUSH: 클라이언트 → 서버 ──
    if (action === "push") {
      if (!data) {
        return NextResponse.json({ error: "data 필요" }, { status: 400 });
      }

      if (table === "settings") {
        const { error } = await supabase
          .from("settings")
          .upsert({ device_id: deviceId, data, updated_at: new Date().toISOString() });
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // entries/vendors: upsert로 안전하게 동기화 (DELETE→INSERT 패턴의 유실 위험 제거)
      if (!data || data.length === 0) {
        // 빈 배열 push는 무시 — localStorage 손상 시 서버 데이터까지 날리는 것 방지
        return NextResponse.json({ ok: true, count: 0, skipped: true });
      }

      const rows = data.map((item: any) => clientToDb(item, deviceId));
      const { error: upsErr } = await supabase
        .from(table)
        .upsert(rows, { onConflict: "id" });
      if (upsErr) throw upsErr;

      return NextResponse.json({ ok: true, count: data.length });
    }

    // ── DELETE: 특정 항목 삭제 ──
    if (action === "delete") {
      if (!ids || !ids.length) {
        return NextResponse.json({ error: "ids 필요" }, { status: 400 });
      }
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("device_id", deviceId)
        .in("id", ids);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "잘못된 action" }, { status: 400 });
  } catch (e: any) {
    console.error("[sync] error:", e);
    return NextResponse.json({ error: "동기화 실패" }, { status: 500 });
  }
}

// ── 컬럼명 변환 ──

function dbToClient(row: any): any {
  return {
    id: row.id,
    date: row.date,
    account: row.account,
    description: row.description,
    vendor: row.vendor,
    type: row.type,
    supply: row.supply,
    vat: row.vat,
    isAsset: row.is_asset,
    evidence: row.evidence,
    source: row.source,
    note: row.note,
    // vendors
    name: row.name,
    category: row.category,
    emoji: row.emoji,
    memo: row.memo,
  };
}

function clientToDb(item: any, deviceId: string): any {
  const base: any = { device_id: deviceId };

  // 공통
  if (item.id) base.id = item.id;
  if (item.date) base.date = item.date;
  if (item.account !== undefined) base.account = item.account;
  if (item.description !== undefined) base.description = item.description;
  if (item.vendor !== undefined) base.vendor = item.vendor;
  if (item.type) base.type = item.type;
  if (item.supply !== undefined) base.supply = item.supply;
  if (item.vat !== undefined) base.vat = item.vat;
  if (item.isAsset !== undefined) base.is_asset = item.isAsset;
  if (item.evidence !== undefined) base.evidence = item.evidence;
  if (item.source !== undefined) base.source = item.source;
  if (item.note !== undefined) base.note = item.note;

  // vendors
  if (item.name !== undefined) base.name = item.name;
  if (item.category !== undefined) base.category = item.category;
  if (item.emoji !== undefined) base.emoji = item.emoji;
  if (item.memo !== undefined) base.memo = item.memo;

  return base;
}
