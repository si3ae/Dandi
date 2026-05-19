/**
 * 간단 IP 기반 메모리 토큰 버킷 레이트리밋.
 * Vercel Serverless에서는 인스턴스마다 메모리가 다르므로 완벽하지 않지만,
 * 단일 인스턴스 내에서의 폭발적 호출은 막아줍니다.
 * 프로덕션에서는 @upstash/ratelimit + Redis로 교체 권장.
 */

const buckets = new Map<string, { tokens: number; lastRefill: number }>();

const MAX_TOKENS = 10;        // 최대 토큰
const REFILL_INTERVAL = 60_000; // 1분마다 리필
const REFILL_AMOUNT = 5;       // 리필당 토큰 수

export function checkRateLimit(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    buckets.set(ip, bucket);
  }

  // 리필
  const elapsed = now - bucket.lastRefill;
  if (elapsed > REFILL_INTERVAL) {
    const refills = Math.floor(elapsed / REFILL_INTERVAL);
    bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + refills * REFILL_AMOUNT);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return { ok: false, remaining: 0 };
  }

  bucket.tokens -= 1;
  return { ok: true, remaining: bucket.tokens };
}

// 오래된 버킷 정리 (메모리 누수 방지) — 10분마다
setInterval(() => {
  const cutoff = Date.now() - 600_000;
  for (const [ip, b] of buckets) {
    if (b.lastRefill < cutoff) buckets.delete(ip);
  }
}, 600_000);
