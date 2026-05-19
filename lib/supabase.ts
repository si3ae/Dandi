/**
 * Supabase 서버사이드 클라이언트
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL  — Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY — service_role 키 (서버 전용, 클라이언트 노출 금지)
 *
 * 미설정 시 null 반환 → localStorage 폴백
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let checked = false;

export function getSupabase(): SupabaseClient | null {
  if (checked) return client;
  checked = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log("[supabase] 환경변수 미설정 — localStorage 폴백");
    return null;
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });
  console.log("[supabase] 연결됨:", url);
  return client;
}
