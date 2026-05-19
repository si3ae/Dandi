-- 단디 Supabase 스키마
-- Supabase Dashboard → SQL Editor에서 실행
-- RLS는 service_role 키로 우회하므로 최소한만 설정

-- 1. 장부 항목
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  date text not null,
  account text,
  description text not null default '',
  vendor text,
  type text not null check (type in ('in', 'out')),
  supply integer not null default 0,
  vat integer not null default 0,
  is_asset boolean default false,
  evidence text default 'none',
  source text,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_entries_device on entries(device_id);
create index if not exists idx_entries_date on entries(device_id, date);

-- 2. 거래처
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  name text not null,
  category text,
  emoji text,
  memo text,
  created_at timestamptz default now()
);

create index if not exists idx_vendors_device on vendors(device_id);

-- 3. 설정
create table if not exists settings (
  device_id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- 4. 사용 로그 (자동 수집 — 모든 음성/OCR 입력)
create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  source text not null,               -- voice, handwriting, receipt, taxinvoice
  whisper_text text,                   -- Whisper 전사 원문
  parsed_json jsonb,                   -- Claude 파싱 결과 전체
  cache_action text,                   -- hit, miss, none
  cache_matched_account text,          -- 캐시 적중 시 매칭된 계정과목
  duration_ms integer,                 -- API 호출 소요 시간
  model text,                          -- 사용된 모델 ID
  success boolean default true,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_usage_device on usage_logs(device_id);
create index if not exists idx_usage_source on usage_logs(source);
create index if not exists idx_usage_created on usage_logs(created_at);

-- 5. 오류 신고 (사용자 수동)
create table if not exists error_reports (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  usage_log_id uuid references usage_logs(id),  -- 어떤 입력에 대한 신고인지
  entry_id text,                        -- 문제된 장부 항목 ID
  report_type text not null,            -- wrong_account, wrong_amount, wrong_vendor, wrong_type, other
  original_value text,                  -- AI가 분류한 값
  corrected_value text,                 -- 사용자가 수정한 값
  description text,                     -- 자유 메모
  created_at timestamptz default now()
);

create index if not exists idx_error_device on error_reports(device_id);
create index if not exists idx_error_usage on error_reports(usage_log_id);
