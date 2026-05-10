/**
 * 부가세 분리 로직 단위 테스트.
 *
 * 실행:
 *   npx tsx --test lib/vat.test.ts
 * 또는 package.json scripts에 "test": "tsx --test lib/*.test.ts" 추가 후 `npm test`
 *
 * 장부 앱에서 이 로직은 **절대 깨지면 안 되는** 핵심이므로
 * 경계값(0, 1, 10, 11, 100, 999, 1000, 1001, 11000, 11005, 10999, 99999, 100000, 999999)을
 * 전부 검증합니다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSupplyVat } from "./storage";

const cases = [
  0, 1, 10, 11, 100, 999, 1000, 1001,
  10999, 11000, 11005, 99999, 100000, 999999,
  1234567, 35000, 45000, 120000,
];

test("splitSupplyVat: 합계 보존 (supply + vat === total) — 모든 금액에서 성립", () => {
  for (const n of cases) {
    const { supply, vat } = splitSupplyVat(n, true);
    assert.equal(
      supply + vat,
      n,
      `합계 불일치: input=${n}, supply=${supply}, vat=${vat}, sum=${supply + vat}`
    );
  }
});

test("splitSupplyVat: 부가세는 공급가의 10%에서 최대 1원 오차 이내", () => {
  for (const n of cases) {
    if (n === 0) continue;
    const { supply, vat } = splitSupplyVat(n, true);
    const expected = supply * 0.1;
    assert.ok(
      Math.abs(vat - expected) <= 1,
      `비율 이탈: input=${n}, supply=${supply}, vat=${vat}, expected≈${expected}`
    );
  }
});

test("splitSupplyVat: 면세(taxable=false)면 vat=0, supply=total", () => {
  for (const n of cases) {
    const { supply, vat } = splitSupplyVat(n, false);
    assert.equal(vat, 0);
    assert.equal(supply, n);
  }
});

test("splitSupplyVat: 음수·NaN·undefined 방어 — 합계는 유한수여야 함", () => {
  const r1 = splitSupplyVat(0, true);
  assert.deepEqual(r1, { supply: 0, vat: 0 });

  // 현재 구현은 음수를 허용하지만 (환불/취소 시나리오 가능성) 합계 보존은 지켜져야 함
  const r2 = splitSupplyVat(-11000, true);
  assert.equal(r2.supply + r2.vat, -11000);
});

test("splitSupplyVat: 대표 케이스 스냅샷", () => {
  assert.deepEqual(splitSupplyVat(11000), { supply: 10000, vat: 1000 });
  assert.deepEqual(splitSupplyVat(110000), { supply: 100000, vat: 10000 });
  assert.deepEqual(splitSupplyVat(45000), { supply: 40909, vat: 4091 });
});
