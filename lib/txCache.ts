/**
 * 거래 캐싱 메커니즘
 *
 * 설계:
 *   1. 사용자가 분류 확인한 거래는 (거래처명, 금액범위, 계정과목) 형태로 저장
 *   2. 새 입력이 들어오면 캐시 먼저 검색
 *   3. 매치되면 AI 호출 없이 자동 분류 (단, "미확인" 상태 그대로 유지)
 *   4. 매치 안 되면 기존대로 AI 호출
 *   5. 캐시 적중률 측정 로그 (실증 단계 보고용)
 */

const KEY_CACHE = "dandi_tx_cache_v1";
const KEY_LOG = "dandi_cache_log_v1";

// ──── 캐시 엔트리 ────

export interface TxCacheEntry {
  vendor: string;        // 거래처명 (정규화됨)
  amountMin: number;     // 금액 범위 하한
  amountMax: number;     // 금액 범위 상한
  account: string;       // 계정과목
  type: "in" | "out";    // 수입/지출
  description: string;   // 대표 거래내용
  evidence: string;      // 증빙 종류
  hitCount: number;       // 적중 횟수
  lastUsed: string;      // ISO
  createdAt: string;     // ISO
}

// ──── 적중 로그 ────

export interface CacheLogEntry {
  timestamp: string;     // ISO
  action: "hit" | "miss";
  vendor: string;
  amount: number;
  matchedAccount?: string;  // hit일 때만
  source: "voice" | "handwriting" | "receipt" | "taxinvoice";
}

// ──── 금액 범위 계산 ────
// ±20% 범위로 매칭 (소상공인 거래는 비슷한 금액이 반복됨)
const AMOUNT_TOLERANCE = 0.2;

function amountRange(amount: number): { min: number; max: number } {
  const margin = Math.max(amount * AMOUNT_TOLERANCE, 1000); // 최소 1000원 마진
  return {
    min: Math.floor(amount - margin),
    max: Math.ceil(amount + margin),
  };
}

// ──── 거래처명 정규화 ────
function normalizeVendor(v: string): string {
  return v
    .trim()
    .replace(/\s+/g, "")       // 공백 제거
    .replace(/[()（）]/g, "")   // 괄호 제거
    .toLowerCase();
}

// ──── CRUD ────

export function loadCache(): TxCacheEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_CACHE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCache(cache: TxCacheEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_CACHE, JSON.stringify(cache));
}

/**
 * 확인된 거래를 캐시에 등록 (또는 기존 엔트리 범위 확장)
 */
export function registerToCache(
  vendor: string,
  amount: number,
  account: string,
  type: "in" | "out",
  description: string,
  evidence: string
) {
  if (!vendor || !account) return; // 거래처·계정과목 없으면 캐시 불가

  const cache = loadCache();
  const normV = normalizeVendor(vendor);
  const now = new Date().toISOString();

  // 이미 같은 거래처+계정과목 캐시가 있으면 범위 확장
  const existing = cache.find(
    (c) => normalizeVendor(c.vendor) === normV && c.account === account && c.type === type
  );

  if (existing) {
    // 범위 확장
    existing.amountMin = Math.min(existing.amountMin, amount);
    existing.amountMax = Math.max(existing.amountMax, amount);
    existing.lastUsed = now;
    existing.description = description; // 최신 설명으로 갱신
  } else {
    // 새 캐시 엔트리
    const { min, max } = amountRange(amount);
    cache.push({
      vendor,
      amountMin: min,
      amountMax: max,
      account,
      type,
      description,
      evidence,
      hitCount: 0,
      lastUsed: now,
      createdAt: now,
    });
  }

  saveCache(cache);
}

/**
 * 캐시에서 매칭 검색
 * @returns 매치된 캐시 엔트리 or null
 */
export function lookupCache(
  vendor: string,
  amount: number
): TxCacheEntry | null {
  if (!vendor) return null;

  const cache = loadCache();
  const normV = normalizeVendor(vendor);

  const match = cache.find((c) => {
    const normC = normalizeVendor(c.vendor);
    // 거래처명 매칭: 정규화 후 동일 or 포함관계
    const vendorMatch = normC === normV || normV.includes(normC) || normC.includes(normV);
    // 금액 범위 매칭: 캐시에 기록된 범위 내인지만 확인 (양방향 OR 제거)
    const amountMatch = amount >= c.amountMin && amount <= c.amountMax;
    return vendorMatch && amountMatch;
  });

  if (match) {
    // 적중 횟수 증가
    match.hitCount += 1;
    match.lastUsed = new Date().toISOString();
    saveCache(cache);
  }

  return match || null;
}

/**
 * 음성 입력 텍스트에서 금액만 추출 (캐시 프리필터용)
 *
 * ⚠ vendor는 정규식으로 추출하지 않음 — "오늘 부산에서" → "오늘 부산" 같은
 * 오분류가 캐시에 영구 저장되는 문제를 방지. vendor는 LLM 결과에서만 사용.
 */
export function extractAmount(text: string): number {
  const amountPatterns = [
    /(\d[\d,]+)\s*원/,
    /(\d+)\s*만\s*(\d+)?\s*천?\s*원/,
  ];

  for (const p of amountPatterns) {
    const m = text.match(p);
    if (m) {
      if (p === amountPatterns[0]) {
        return parseInt(m[1].replace(/,/g, ""));
      } else {
        return parseInt(m[1]) * 10000 + (m[2] ? parseInt(m[2]) * 1000 : 0);
      }
    }
  }
  return 0;
}

/**
 * @deprecated extractAmount + LLM vendor 사용 권장
 */
export function extractVendorAmount(text: string): {
  vendor: string;
  amount: number;
} | null {
  const amount = extractAmount(text);
  if (!amount) return null;
  // vendor는 더 이상 정규식으로 추출하지 않음 — null 반환하여 캐시 프리필터 비활성화
  return null;
}

// ──── 적중률 로그 ────

export function logCacheEvent(
  action: "hit" | "miss",
  vendor: string,
  amount: number,
  source: CacheLogEntry["source"],
  matchedAccount?: string
) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY_LOG);
    const log: CacheLogEntry[] = raw ? JSON.parse(raw) : [];
    log.push({
      timestamp: new Date().toISOString(),
      action,
      vendor,
      amount,
      matchedAccount,
      source,
    });
    // 최대 1000건 보관 (실증 4주 기준 충분)
    if (log.length > 1000) log.splice(0, log.length - 1000);
    localStorage.setItem(KEY_LOG, JSON.stringify(log));
  } catch {
    // 로그 실패는 무시
  }
}

/**
 * 캐시 적중률 통계 (실증 보고용)
 */
export function getCacheStats(): {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRate: number;       // 0~1
  savedApiCalls: number; // 절감한 AI 호출 수
  bySource: Record<string, { hits: number; misses: number }>;
} {
  if (typeof window === "undefined") {
    return { totalRequests: 0, hits: 0, misses: 0, hitRate: 0, savedApiCalls: 0, bySource: {} };
  }
  try {
    const raw = localStorage.getItem(KEY_LOG);
    const log: CacheLogEntry[] = raw ? JSON.parse(raw) : [];

    const hits = log.filter((l) => l.action === "hit").length;
    const misses = log.filter((l) => l.action === "miss").length;
    const total = hits + misses;

    const bySource: Record<string, { hits: number; misses: number }> = {};
    log.forEach((l) => {
      if (!bySource[l.source]) bySource[l.source] = { hits: 0, misses: 0 };
      bySource[l.source][l.action === "hit" ? "hits" : "misses"] += 1;
    });

    return {
      totalRequests: total,
      hits,
      misses,
      hitRate: total > 0 ? hits / total : 0,
      savedApiCalls: hits,
      bySource,
    };
  } catch {
    return { totalRequests: 0, hits: 0, misses: 0, hitRate: 0, savedApiCalls: 0, bySource: {} };
  }
}

/**
 * 캐시 통계 CSV 내보내기 (실증 보고서 첨부용)
 */
export function exportCacheLogCSV(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(KEY_LOG);
    const log: CacheLogEntry[] = raw ? JSON.parse(raw) : [];
    const header = "timestamp,action,vendor,amount,matchedAccount,source";
    const rows = log.map((l) =>
      [l.timestamp, l.action, l.vendor, l.amount, l.matchedAccount || "", l.source].join(",")
    );
    return "\uFEFF" + [header, ...rows].join("\n");
  } catch {
    return "";
  }
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_CACHE);
  localStorage.removeItem(KEY_LOG);
}
