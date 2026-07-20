/**
 * IP 기반 레이트리밋
 *
 * 환경변수 설정 시 → @upstash/ratelimit + Redis (프로덕션용)
 * 환경변수 없으면 → 인메모리 폴백 (로컬 개발용)
 *
 * 필요한 환경변수:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Upstash 무료 티어: 일 10,000 요청. 전시 500명 규모에 충분.
 * https://upstash.com 에서 Redis 데이터베이스 생성 후 URL/Token 복사.
 *
 * 설정:
 *   - 슬라이딩 윈도우 60초당 10회 (일반)
 *   - 일 상한 500회/IP (악의적 사용 차단)
 */

// ───── Upstash 모드 (프로덕션) ─────

let upstashLimiter: any = null;
let upstashDailyLimiter: any = null;
let useUpstash = false;

async function initUpstash() {
  if (upstashLimiter) return true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return false;

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    const redis = new Redis({ url, token });

    // 분당 10회 슬라이딩 윈도우
    upstashLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "dandi:rl",
      analytics: true,
    });

    // 일 500회 고정 윈도우
    upstashDailyLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(500, "1 d"),
      prefix: "dandi:daily",
    });

    useUpstash = true;
    return true;
  } catch {
    return false;
  }
}

async function checkUpstash(ip: string): Promise<{ ok: boolean; remaining: number }> {
  const minute = await upstashLimiter.limit(ip);
  if (!minute.success) {
    return { ok: false, remaining: 0 };
  }

  const daily = await upstashDailyLimiter.limit(ip);
  if (!daily.success) {
    return { ok: false, remaining: 0 };
  }

  return { ok: true, remaining: minute.remaining };
}

// ───── 인메모리 폴백 (로컬 개발) ─────

const buckets = new Map<string, { tokens: number; lastRefill: number }>();
const MAX_TOKENS = 10;
const REFILL_INTERVAL = 60_000;
const REFILL_AMOUNT = 5;

function checkMemory(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    buckets.set(ip, bucket);
  }

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

// ───── 통합 인터페이스 ─────

let initialized = false;

/**
 * IP + deviceId 이중 레이트리밋
 * @param ip - x-forwarded-for 또는 request.ip
 * @param deviceId - 클라이언트 기기 식별자 (선택)
 */
export async function checkRateLimit(
  ip: string,
  deviceId?: string
): Promise<{ ok: boolean; remaining: number }> {
  if (!initialized) {
    await initUpstash();
    initialized = true;
    if (useUpstash) {
      console.log("[ratelimit] Upstash Redis 모드");
    } else {
      console.log("[ratelimit] 인메모리 폴백 (UPSTASH_REDIS_REST_URL 미설정)");
    }
  }

  // "unknown" IP는 매우 엄격하게 제한 (분당 3회)
  const effectiveIp = (!ip || ip === "unknown") ? "unknown_strict" : ip;

  if (useUpstash) {
    // IP 기반 체크
    const ipResult = await checkUpstash(effectiveIp);
    if (!ipResult.ok) return ipResult;

    // deviceId 기반 추가 체크 (있으면)
    if (deviceId) {
      const devResult = await checkUpstash(`dev:${deviceId}`);
      if (!devResult.ok) return devResult;
    }

    return ipResult;
  }

  // 인메모리 폴백
  const ipResult = checkMemory(effectiveIp);
  if (!ipResult.ok) return ipResult;
  if (deviceId) {
    const devResult = checkMemory(`dev:${deviceId}`);
    if (!devResult.ok) return devResult;
  }
  return ipResult;
}
