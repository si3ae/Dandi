/**
 * 한국(KST, UTC+9) 기준 날짜 유틸.
 *
 * ⚠️ `new Date().toISOString().slice(0,10)` 은 실행 환경(서버·브라우저)과
 * 관계없이 **항상 UTC 기준** 날짜를 반환합니다.
 * 한국 사용자의 자정 직후(KST 00:00~08:59)에는 전날 날짜가 찍혀
 * 장부의 월·분기 마감이 하루 밀리는 버그가 발생합니다.
 *
 * 장부 앱 전체에서 "오늘"을 참조할 때는 반드시 이 파일의 함수를 사용하세요.
 * 직접 `new Date().toISOString()`을 호출하지 마세요.
 */

const KST = "Asia/Seoul";

// 로케일 'sv-SE'는 YYYY-MM-DD / HH:mm:ss 포맷을 주므로 파싱 없이 바로 사용 가능합니다.

/** YYYY-MM-DD (KST) */
export function todayKST(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: KST }).format(new Date());
}

/** YYYY-MM (KST) — 간편장부 월 조회 기본값 등 */
export function thisMonthKST(): string {
  return todayKST().slice(0, 7);
}

/** 임의 Date 객체를 KST의 YYYY-MM-DD 문자열로 변환 */
export function toKSTDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: KST }).format(d);
}

/**
 * 다음 세무 일정(부가세 1기/2기 확정신고, 종합소득세) 중 가장 가까운 것.
 *
 * 일반과세자 기준 (법령상 토·일·공휴일이면 그 다음 영업일로 연장되지만
 * 여기서는 단순화해 캘린더 날짜만 계산합니다 — 정확한 영업일 보정은
 * 세무사/국세청 안내를 따라야 함을 UI에서 명시하세요).
 *
 * - 부가세 1기 확정: 7/25
 * - 부가세 2기 확정: 1/25 (다음 해)
 * - 종합소득세: 5/31
 */
export interface TaxDeadline {
  label: string;
  date: string; // YYYY-MM-DD
  daysLeft: number;
}

export function upcomingTaxDeadlines(from: Date = new Date()): TaxDeadline[] {
  const todayStr = toKSTDate(from);
  const [y, m, d] = todayStr.split("-").map(Number);

  // KST 자정을 UTC ms로: (KST 00:00 = UTC 전날 15:00)
  const kstMidnightUTC = (yy: number, mm: number, dd: number) =>
    Date.UTC(yy, mm - 1, dd) - 9 * 60 * 60 * 1000;

  const todayMs = kstMidnightUTC(y, m, d);

  const candidates: { label: string; y: number; m: number; d: number }[] = [
    { label: "부가세 2기 확정신고", y, m: 1, d: 25 },
    { label: "종합소득세 신고", y, m: 5, d: 31 },
    { label: "부가세 1기 확정신고", y, m: 7, d: 25 },
    { label: "부가세 2기 확정신고", y: y + 1, m: 1, d: 25 },
    { label: "종합소득세 신고", y: y + 1, m: 5, d: 31 },
    { label: "부가세 1기 확정신고", y: y + 1, m: 7, d: 25 },
  ];

  return candidates
    .map((c) => {
      const ms = kstMidnightUTC(c.y, c.m, c.d);
      const daysLeft = Math.round((ms - todayMs) / (24 * 60 * 60 * 1000));
      const date = `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
      return { label: c.label, date, daysLeft };
    })
    .filter((c) => c.daysLeft >= 0)
    .slice(0, 3);
}
