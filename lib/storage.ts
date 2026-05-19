import { todayKST } from "./date";

export type EntryType = "in" | "out";

export type EvidenceType =
  | "tax_invoice"      // 세금계산서
  | "cash_receipt"     // 현금영수증
  | "card"             // 신용카드
  | "simple_receipt"   // 일반(간이) 영수증
  | "none";            // 증빙 없음

export interface Entry {
  id: string;
  date: string;            // YYYY-MM-DD  ① 일자
  account?: string;        // ② 계정과목 (식재료비, 매출, 공과금 ...)
  description: string;     // ③ 거래내용
  vendor?: string;         // ④ 거래처
  type: EntryType;         // 수입(⑤) 또는 비용(⑥)
  supply: number;          // 공급가액 (부가세 제외)
  vat: number;             // 부가세
  isAsset?: boolean;       // ⑦ 사업용 자산 매입 여부
  evidence?: EvidenceType; // 증빙 종류
  source?: "voice" | "handwriting" | "receipt" | "taxinvoice" | "manual" | "dongbaek";
  note?: string;           // ⑧ 비고
}

const KEY = "dandi_entries_v2";

export function loadEntries(): Entry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // 신규 사용자에게 가짜 데이터 자동 생성하지 않음
      // 시연 시 샘플 데이터가 필요하면 loadSeedEntries()를 명시적으로 호출
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveEntries(entries: Entry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function addEntries(newOnes: Omit<Entry, "id">[]): Entry[] {
  const cur = loadEntries();
  const withIds: Entry[] = newOnes.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
  }));
  const next = [...cur, ...withIds];
  saveEntries(next);
  return next;
}

export function deleteEntry(id: string): Entry[] {
  const cur = loadEntries();
  const next = cur.filter((e) => e.id !== id);
  saveEntries(next);
  return next;
}

export function clearEntries() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

// ───── 계산 유틸 ─────

export function fmt(n: number): string {
  return n.toLocaleString() + "원";
}

export function total(e: Entry): number {
  return (e.supply || 0) + (e.vat || 0);
}

export function sumIncome(entries: Entry[]): number {
  return entries.filter((e) => e.type === "in").reduce((s, e) => s + total(e), 0);
}

export function sumExpense(entries: Entry[]): number {
  return entries.filter((e) => e.type === "out").reduce((s, e) => s + total(e), 0);
}

export function sumIncomeSupply(entries: Entry[]): number {
  return entries.filter((e) => e.type === "in").reduce((s, e) => s + (e.supply || 0), 0);
}

export function sumIncomeVat(entries: Entry[]): number {
  return entries.filter((e) => e.type === "in").reduce((s, e) => s + (e.vat || 0), 0);
}

export function sumExpenseSupply(entries: Entry[]): number {
  return entries.filter((e) => e.type === "out").reduce((s, e) => s + (e.supply || 0), 0);
}

export function sumExpenseVat(entries: Entry[]): number {
  return entries.filter((e) => e.type === "out").reduce((s, e) => s + (e.vat || 0), 0);
}

/**
 * 합계금액(부가세 포함)을 받아서 공급가액과 부가세로 분리.
 * 일반과세자 기준 (10%). 면세/간이는 vat=0.
 *
 * ⚠️ 불변식 (반드시 `lib/vat.test.ts`의 테스트로 보장):
 *   1. **합계 보존**: `supply + vat === totalAmt` (항상 성립)
 *   2. **비율 근사**: `|vat - supply * 0.1| <= 1` (반올림 오차 1원 이내)
 *
 * 합계 보존을 우선합니다 — 장부 합계가 원본 금액과 1원이라도 달라지면
 * 간편장부 CSV와 영수증·카드전표 대조 시 사용자가 "왜 안 맞지?"라는 혼란을
 * 겪기 때문입니다. 부가세 비율은 반올림 오차 범위 내에서만 근사됩니다.
 *
 * 경계값 예시:
 *   splitSupplyVat(11000) → { supply: 10000, vat: 1000 }   합계 11000 ✅
 *   splitSupplyVat(11005) → { supply: 10005, vat: 1000 }   합계 11005 ✅
 *   splitSupplyVat(10999) → { supply: 9999,  vat: 1000 }   합계 10999 ✅
 *   splitSupplyVat(1)     → { supply: 1,     vat: 0    }   합계 1 ✅
 */
export function splitSupplyVat(
  totalAmt: number,
  taxable: boolean = true
): { supply: number; vat: number } {
  if (!taxable || !totalAmt) return { supply: totalAmt || 0, vat: 0 };
  // 합계 / 1.1 = 공급가액 (반올림) → 부가세는 합계에서 역산해 합계 보존
  const supply = Math.round(totalAmt / 1.1);
  const vat = totalAmt - supply;
  return { supply, vat };
}

/** 시연용 샘플 데이터 — 명시적 호출 시에만 사용 */
export function loadSeedEntries(): Entry[] {
  const seed = seedEntries();
  const existing = loadEntries();
  const merged = [...existing, ...seed];
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

function seedEntries(): Entry[] {
  const today = todayKST();
  // 오늘 기준 며칠 전 날짜 계산
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  return [
    {
      id: crypto.randomUUID(),
      date: daysAgo(6),
      account: "매출",
      description: "현금 매출",
      vendor: "일반고객",
      type: "in",
      ...splitSupplyVat(120000),
      evidence: "cash_receipt",
      source: "manual",
    },
    {
      id: crypto.randomUUID(),
      date: daysAgo(5),
      account: "식재료비",
      description: "식자재 구입",
      vendor: "서면 식자재마트",
      type: "out",
      ...splitSupplyVat(45000),
      evidence: "simple_receipt",
      source: "manual",
    },
    {
      id: crypto.randomUUID(),
      date: daysAgo(4),
      account: "매출",
      description: "카드 매출",
      vendor: "단골손님",
      type: "in",
      ...splitSupplyVat(85000),
      evidence: "card",
      source: "voice",
    },
    {
      id: crypto.randomUUID(),
      date: daysAgo(3),
      account: "공과금",
      description: "전기요금",
      vendor: "한국전력",
      type: "out",
      ...splitSupplyVat(32000),
      evidence: "cash_receipt",
      source: "manual",
    },
    {
      id: crypto.randomUUID(),
      date: daysAgo(2),
      account: "식재료비",
      description: "채소 구입",
      vendor: "부전시장",
      type: "out",
      ...splitSupplyVat(28000),
      evidence: "simple_receipt",
      source: "receipt",
    },
    {
      id: crypto.randomUUID(),
      date: daysAgo(1),
      account: "매출",
      description: "배달 매출",
      vendor: "배달앱",
      type: "in",
      ...splitSupplyVat(95000),
      evidence: "card",
      source: "manual",
    },
    {
      id: crypto.randomUUID(),
      date: today,
      account: "소모품비",
      description: "포장용기 구입",
      vendor: "온라인몰",
      type: "out",
      ...splitSupplyVat(15000),
      evidence: "card",
      source: "manual",
    },
  ];
}

// ───── 간편장부 CSV 내보내기 ─────

export function toGanpyeonCSV(entries: Entry[]): string {
  // 국세청 간편장부 8컬럼 (수입/비용/자산은 금액·부가세 분리)
  const header = [
    "일자",
    "계정과목",
    "거래내용",
    "거래처",
    "수입_금액",
    "수입_부가세",
    "비용_금액",
    "비용_부가세",
    "자산_금액",
    "자산_부가세",
    "비고",
  ];
  const rows = entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const isAsset = !!e.isAsset;
      const isIncome = e.type === "in" && !isAsset;
      const isExpense = e.type === "out" && !isAsset;
      return [
        e.date,
        e.account || "",
        e.description || "",
        e.vendor || "",
        isIncome ? e.supply : "",
        isIncome ? e.vat : "",
        isExpense ? e.supply : "",
        isExpense ? e.vat : "",
        isAsset ? e.supply : "",
        isAsset ? e.vat : "",
        e.note || "",
      ];
    });
  const all = [header, ...rows];
  // CSV escape
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  // BOM 추가 — 엑셀에서 한글 깨짐 방지
  return "\uFEFF" + all.map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ───── 거래처 (Vendor) ─────

export interface Vendor {
  id: string;
  name: string;
  category: string;
  emoji: string;
}

const VENDOR_KEY = "dandi_vendors_v1";

/** 거래처 목록 로드. 최초 진입 시 빈 배열. */
export function loadVendors(): Vendor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VENDOR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVendors(vendors: Vendor[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VENDOR_KEY, JSON.stringify(vendors));
}

/**
 * 거래처 추가. 같은 이름이 이미 있으면 카테고리만 업데이트하고 새로 만들지 않습니다
 * (음성·OCR 결과로 자동 추가 시 중복 방지용).
 */
export function addVendor(v: Omit<Vendor, "id">): Vendor[] {
  const cur = loadVendors();
  const existing = cur.find((x) => x.name === v.name);
  let next: Vendor[];
  if (existing) {
    next = cur.map((x) =>
      x.id === existing.id ? { ...x, category: v.category, emoji: v.emoji } : x
    );
  } else {
    next = [...cur, { ...v, id: crypto.randomUUID() }];
  }
  saveVendors(next);
  return next;
}

export function deleteVendor(id: string): Vendor[] {
  const cur = loadVendors();
  const next = cur.filter((v) => v.id !== id);
  saveVendors(next);
  return next;
}

// ───── 요일별 집계 ─────

/**
 * 거래 항목을 요일별(월=0 ... 일=6)로 집계한 수입/지출 배열을 반환합니다.
 *
 * ⚠️ 타임존 주의: `new Date("2026-04-15")` 는 UTC 자정으로 파싱되므로
 * `getDay()` 는 환경에 따라 전날 요일이 나올 수 있습니다. KST 기준 일관성을
 * 위해 날짜 문자열을 수동 파싱해서 계산합니다.
 */
export function sumByWeekday(entries: Entry[]): { income: number[]; expense: number[] } {
  const income = [0, 0, 0, 0, 0, 0, 0];
  const expense = [0, 0, 0, 0, 0, 0, 0];

  for (const e of entries) {
    if (!e.date) continue;
    const m = e.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) continue;
    const [, y, mo, d] = m;
    // Date.UTC로 만든 뒤 getUTCDay() — 로컬 타임존 영향 제거
    const js = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay();
    // JS: 일=0, 월=1 ... 토=6  →  앱: 월=0, 화=1 ... 일=6
    const idx = (js + 6) % 7;
    const amt = total(e);
    if (e.type === "in") income[idx] += amt;
    else expense[idx] += amt;
  }

  return { income, expense };
}

// ───── 앱 설정 (Settings) ─────

export type TaxAlertLevel = "minimal" | "normal" | "thorough";

/** 각 알림 강도에서 "마감일 N일 전"에 알림을 울릴 N 배열. */
export const TAX_ALERT_DAYS: Record<TaxAlertLevel, number[]> = {
  minimal: [7, 1],
  normal: [30, 14, 7, 3, 1],
  thorough: [30, 21, 14, 7, 5, 3, 2, 1],
};

export interface Settings {
  alertTaxDeadline: boolean;
  taxAlertLevel: TaxAlertLevel;
  alertExpenseSpike: boolean;
  alertDongbaekAuto: boolean;
}

const SETTINGS_KEY = "dandi_settings_v1";

export const DEFAULT_SETTINGS: Settings = {
  alertTaxDeadline: true,
  taxAlertLevel: "normal",
  alertExpenseSpike: true,
  alertDongbaekAuto: false,
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    // 이전 버전에서 누락된 필드가 있을 수 있으므로 기본값과 머지
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ───── AI 인사이트 생성 ─────

export interface Insight {
  emoji: string;
  text: string;
  type: "info" | "warning" | "positive";
}

export function generateInsights(entries: Entry[]): Insight[] {
  if (entries.length < 5) return [];

  const insights: Insight[] = [];
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

  const thisMonthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
  const lastMonthEntries = entries.filter((e) => e.date.startsWith(lastMonth));

  const thisInc = sumIncome(thisMonthEntries);
  const thisExp = sumExpense(thisMonthEntries);
  const lastInc = sumIncome(lastMonthEntries);
  const lastExp = sumExpense(lastMonthEntries);

  // 1. 수입 증감
  if (lastInc > 0 && thisInc > 0) {
    const diff = Math.round(((thisInc - lastInc) / lastInc) * 100);
    if (diff > 10) {
      insights.push({ emoji: "📈", text: `이번 달 수입이 지난달 대비 ${diff}% 증가했어요!`, type: "positive" });
    } else if (diff < -10) {
      insights.push({ emoji: "📉", text: `이번 달 수입이 지난달 대비 ${Math.abs(diff)}% 감소했어요.`, type: "warning" });
    }
  }

  // 2. 계정과목별 비중 분석
  const byAccount = new Map<string, number>();
  thisMonthEntries.filter((e) => e.type === "out").forEach((e) => {
    const k = e.account || "기타";
    byAccount.set(k, (byAccount.get(k) || 0) + total(e));
  });

  if (thisExp > 0) {
    for (const [account, amount] of byAccount) {
      const pct = Math.round((amount / thisExp) * 100);
      if (pct >= 40) {
        insights.push({ emoji: "⚠️", text: `${account}이(가) 지출의 ${pct}%를 차지해요. 비용 절감을 검토해보세요.`, type: "warning" });
      }
    }
  }

  // 3. 지출 급증
  if (lastExp > 0 && thisExp > 0) {
    const diff = Math.round(((thisExp - lastExp) / lastExp) * 100);
    if (diff > 20) {
      insights.push({ emoji: "🔥", text: `이번 달 지출이 지난달 대비 ${diff}% 늘었어요! 점검이 필요해요.`, type: "warning" });
    } else if (diff < -10) {
      insights.push({ emoji: "💪", text: `이번 달 지출이 지난달 대비 ${Math.abs(diff)}% 줄었어요. 잘 관리하고 있어요!`, type: "positive" });
    }
  }

  // 4. 순이익
  const net = thisInc - thisExp;
  if (thisMonthEntries.length >= 3) {
    if (net > 0) {
      insights.push({ emoji: "✅", text: `이번 달 순이익 ${fmt(net)}원이에요. 좋은 흐름이에요!`, type: "positive" });
    } else if (net < 0) {
      insights.push({ emoji: "😥", text: `이번 달 ${fmt(Math.abs(net))}원 적자예요. 매출 확대나 비용 절감을 고민해보세요.`, type: "warning" });
    }
  }

  // 5. 증빙 없는 거래
  const noEvidence = thisMonthEntries.filter((e) => !e.evidence || e.evidence === "none").length;
  if (noEvidence >= 3) {
    insights.push({ emoji: "📋", text: `증빙 없는 거래가 ${noEvidence}건이에요. 세금 신고 시 불이익이 있을 수 있어요.`, type: "info" });
  }

  return insights.slice(0, 4); // 최대 4개
}
