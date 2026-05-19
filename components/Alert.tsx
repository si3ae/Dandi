"use client";
import { useEffect, useState } from "react";
import type { Screen } from "@/lib/types";
import {
  Entry, fmt, loadEntries, addEntries, total, splitSupplyVat,
  Settings, DEFAULT_SETTINGS, loadSettings, TAX_ALERT_DAYS, downloadCSV,
} from "@/lib/storage";
import { upcomingTaxDeadlines } from "@/lib/date";
import { getCacheStats, exportCacheLogCSV, loadCache } from "@/lib/txCache";
import GradientHeader from "@/components/GradientHeader";
import AlertSettings from "@/components/AlertSettings";

export default function Alert({ onGo }: { onGo: (s: Screen) => void }) {
  // 세무 일정은 매년 바뀌므로 하드코딩 금지 — lib/date.ts에서 동적 계산
  const deadlines = upcomingTaxDeadlines();

  // 사용자 설정 반영 — AlertSettings에서 저장한 값을 읽어 표시 여부 결정
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [lastExportDays, setLastExportDays] = useState<number | null>(null);
  const [exportChecked, setExportChecked] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    const last = localStorage.getItem("dandi_last_export");
    setLastExportDays(last ? Math.floor((Date.now() - Number(last)) / 86400000) : null);
    setExportChecked(true);
  }, []);

  // AlertSettings 자식이 값을 바꾸면 여기도 다시 읽도록 focus 복귀·storage 이벤트 반영
  useEffect(() => {
    const onFocus = () => setSettings(loadSettings());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "dandi_settings_v1") setSettings(loadSettings());
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // 세무 일정 알림이 켜져 있을 때만, 현재 강도의 D-day 임계값에 걸린 마감만 필터
  const alertDays = TAX_ALERT_DAYS[settings.taxAlertLevel];
  const todaysAlerts = settings.alertTaxDeadline
    ? deadlines.filter((d) => alertDays.includes(d.daysLeft))
    : [];

  return (
    <>
      <GradientHeader title="알림" sub="세무 일정 · 지출 경보" onBack={() => onGo("home")} />
      <div style={{ height: 8 }} />
      <div className="card">
        <div className="ct">🔔 오늘의 알림</div>
        {todaysAlerts.length === 0 && !settings.alertTaxDeadline && (
          <div style={{ fontSize: 11, color: "#999", padding: "8px 4px" }}>
            세무 마감 알림이 꺼져 있습니다. 아래 설정에서 켤 수 있어요.
          </div>
        )}
        {todaysAlerts.length === 0 && settings.alertTaxDeadline && (
          <div style={{ fontSize: 11, color: "#999", padding: "8px 4px" }}>
            오늘 울릴 세무 알림이 없어요. 여유로운 하루입니다 🕊
          </div>
        )}
        {todaysAlerts.map((d) => (
          <div key={`${d.label}-${d.date}`} className="entry">
            <div>
              <div className="ei">
                {d.label} D-{d.daysLeft}
              </div>
              <div className="ed">{d.date}까지 신고 필요</div>
            </div>
          </div>
        ))}
        <div className="entry" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <div>
            <div className="ei">
              {!exportChecked ? "⏳ 확인 중..." :
               lastExportDays === null ? "⚠️ 아직 백업한 적이 없어요!" :
               lastExportDays >= 7 ? `⚠️ 마지막 백업이 ${lastExportDays}일 전이에요!` :
               `💡 마지막 백업: ${lastExportDays}일 전`}
            </div>
            <div className="ed">
              장부 데이터는 브라우저에만 저장됩니다. 캐시 삭제 시 데이터가 사라질 수 있어요.
            </div>
          </div>
          <button
            style={{
              padding: "10px 14px", borderRadius: 12, border: "none",
              background: "#e8527a", color: "#fff", fontSize: 13,
              fontWeight: 600, cursor: "pointer", width: "100%",
            }}
            onClick={() => {
              const entries = loadEntries();
              if (entries.length === 0) { alert("내보낼 내역이 없어요."); return; }
              const header = "날짜,구분,계정과목,설명,거래처,공급가액,부가세,합계,증빙,출처";
              const rows = entries.map((e: Entry) =>
                `${e.date},${e.type === "in" ? "수입" : "지출"},${e.account},${e.description},${e.vendor || ""},${e.supply},${e.vat},${e.supply + e.vat},${e.evidence},${e.source}`
              );
              const csv = "\uFEFF" + header + "\n" + rows.join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `dandi_backup_${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
              localStorage.setItem("dandi_last_export", String(Date.now()));
              setLastExportDays(0);
              alert("CSV 백업 완료!");
            }}
          >
            📥 지금 CSV 백업하기
          </button>
        </div>
      </div>
      {settings.alertTaxDeadline && (
        <div className="card">
          <div className="ct">📅 다가오는 세무 일정</div>
          {deadlines.map((d) => (
            <div key={`${d.label}-${d.date}`} className="entry">
              <div>
                <div className="ei">{d.label}</div>
                <div className="ed">
                  {d.date} 마감 · D-{d.daysLeft}
                </div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#999", padding: "8px 4px 0" }}>
            * 마감일이 토·일·공휴일이면 다음 영업일로 연장됩니다. 정확한 일정은 홈택스 또는 세무사에 확인하세요.
          </div>
        </div>
      )}
      <AlertSettings onChanged={setSettings} />

      <DongbaekDemo onGo={onGo} />

      {/* 캐시 적중률 대시보드 (실증 보고용) */}
      <CacheDashboard />
    </>
  );
}

function CacheDashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const stats = getCacheStats();
  const cache = loadCache();
  const hitPct = stats.totalRequests > 0 ? Math.round(stats.hitRate * 100) : 0;
  const savedCost = stats.savedApiCalls * 4; // ~4원/호출

  return (
    <div className="card">
      <div className="ct">⚡ AI 호출 절감 현황</div>
      <div style={{ textAlign: "center", padding: "8px 0 12px" }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: "#4A90E2" }}>{hitPct}%</div>
        <div style={{ fontSize: 12, color: "#888" }}>캐시 적중률</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: "#f0fff4", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#4CAF50" }}>{stats.savedApiCalls}건</div>
          <div style={{ fontSize: 10, color: "#888" }}>AI 호출 절감</div>
        </div>
        <div style={{ flex: 1, background: "#fff8f0", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{stats.totalRequests}건</div>
          <div style={{ fontSize: 10, color: "#888" }}>총 요청</div>
        </div>
        <div style={{ flex: 1, background: "#f8f5ff", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c084fc" }}>~{savedCost}원</div>
          <div style={{ fontSize: 10, color: "#888" }}>절감 비용</div>
        </div>
      </div>

      {/* 입력 방식별 분석 */}
      {stats.totalRequests > 0 && Object.keys(stats.bySource).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {Object.entries(stats.bySource).map(([src, s]) => {
            const srcTotal = s.hits + s.misses;
            const srcPct = srcTotal > 0 ? Math.round((s.hits / srcTotal) * 100) : 0;
            const label = src === "voice" ? "🎤 음성" : src === "receipt" ? "🧾 영수증" : src === "handwriting" ? "✍️ 손글씨" : "📄 세금계산서";
            return (
              <div key={src} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 600 }}>{srcPct}% ({s.hits}/{srcTotal})</span>
                </div>
                <div style={{ height: 5, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${srcPct}%`, height: "100%", background: "#4A90E2", borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 학습된 거래 패턴 */}
      {cache.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 6 }}>학습된 거래 패턴 ({cache.length}건)</div>
          {cache.slice(0, 5).map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", borderBottom: "0.5px solid #f0f0f0" }}>
              <span>{c.vendor} → {c.account}</span>
              <span style={{ color: "#888" }}>적중 {c.hitCount}회</span>
            </div>
          ))}
        </div>
      )}

      <button
        style={{
          width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid #ddd",
          background: "#fff", color: "#666", fontSize: 12, cursor: "pointer",
        }}
        onClick={() => {
          const csv = exportCacheLogCSV();
          if (csv) downloadCSV("dandi-cache-log.csv", csv);
        }}
      >
        📥 캐시 로그 CSV 내보내기 (실증 보고용)
      </button>

      {stats.totalRequests === 0 && cache.length === 0 && (
        <div style={{ fontSize: 11, color: "#aaa", textAlign: "center", padding: "8px 0" }}>
          아직 데이터가 없어요. 거래를 확인하면 자동으로 학습됩니다.
        </div>
      )}
    </div>
  );
}

const DONGBAEK_DEMO = [
  { vendor: "자갈치시장 횟집", amount: 45000, account: "매출", type: "in" as const, time: "09:32" },
  { vendor: "서면 식자재마트", amount: 28000, account: "식재료비", type: "out" as const, time: "11:15" },
  { vendor: "부산 수산시장", amount: 62000, account: "식재료비", type: "out" as const, time: "13:40" },
  { vendor: "일반고객", amount: 35000, account: "매출", type: "in" as const, time: "14:22" },
  { vendor: "GS편의점 자갈치역점", amount: 8500, account: "소모품비", type: "out" as const, time: "17:05" },
];

function DongbaekDemo({ onGo }: { onGo: (s: Screen) => void }) {
  const [payments, setPayments] = useState<typeof DONGBAEK_DEMO>([]);
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState<Set<number>>(new Set());
  const [allDone, setAllDone] = useState(false);

  function fetchDemo() {
    setLoading(true); setSynced(new Set()); setAllDone(false); setPayments([]);
    DONGBAEK_DEMO.forEach((item, i) => {
      setTimeout(() => {
        setPayments((prev) => [...prev, item]);
        if (i === DONGBAEK_DEMO.length - 1) setLoading(false);
      }, (i + 1) * 400);
    });
  }

  function syncOne(idx: number) {
    const p = payments[idx];
    const today = new Date().toISOString().slice(0, 10);
    const sv = splitSupplyVat(p.amount, true);
    addEntries([{
      date: today, account: p.account,
      description: `동백전 ${p.type === "in" ? "결제 수입" : "결제"}`,
      vendor: p.vendor, type: p.type, supply: sv.supply, vat: sv.vat,
      evidence: "card", source: "dongbaek",
    }]);
    setSynced((prev) => new Set(prev).add(idx));
  }

  function syncAll() {
    const today = new Date().toISOString().slice(0, 10);
    const toSync = payments.filter((_, i) => !synced.has(i));
    addEntries(toSync.map((p) => {
      const sv = splitSupplyVat(p.amount, true);
      return {
        date: today, account: p.account,
        description: `동백전 ${p.type === "in" ? "결제 수입" : "결제"}`,
        vendor: p.vendor, type: p.type, supply: sv.supply, vat: sv.vat,
        evidence: "card" as const, source: "dongbaek" as const,
      };
    }));
    setSynced(new Set(payments.map((_, i) => i)));
    setAllDone(true);
  }

  const pendingCount = payments.filter((_, i) => !synced.has(i)).length;

  return (
    <div className="card">
      <div className="ct">💳 동백전 결제 연동</div>
      <div style={{
        background: "#fff8e1", borderRadius: 8, padding: "5px 8px", fontSize: 11,
        color: "#b8860b", display: "flex", alignItems: "center", gap: 4, marginBottom: 10,
      }}>
        🔶 데모 모드 — 실제 동백전 API 연동 시 실시간 결제 내역을 불러옵니다
      </div>

      {payments.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
            동백전으로 결제한 내역을 자동으로 장부에 기록합니다.
          </div>
          <button
            style={{
              width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
              background: "#e8527a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
            onClick={fetchDemo}
          >
            📲 동백전 결제 내역 가져오기 (데모)
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 10, fontSize: 12, color: "#888" }}>
          🔄 동백전 서버에서 결제 내역을 가져오는 중...
        </div>
      )}

      {payments.map((p, i) => (
        <div key={i} className="entry" style={{ opacity: synced.has(i) ? 0.5 : 1, transition: "opacity 0.3s" }}>
          <div style={{ flex: 1 }}>
            <div className="ei">{p.vendor}</div>
            <div className="ed">{p.time} · {p.account}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="amt" style={{ color: p.type === "in" ? "#4CAF50" : "#f472b6" }}>
              {p.type === "in" ? "+" : "-"}{fmt(p.amount)}
            </span>
            {synced.has(i) ? (
              <span style={{ fontSize: 11, color: "#4CAF50" }}>✓</span>
            ) : (
              <button
                onClick={() => syncOne(i)}
                style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 6,
                  border: "1px solid #e8527a", background: "#fff", color: "#e8527a", cursor: "pointer",
                }}
              >
                반영
              </button>
            )}
          </div>
        </div>
      ))}

      {payments.length > 0 && !loading && pendingCount > 0 && (
        <button
          style={{
            width: "100%", padding: "10px 0", marginTop: 8, borderRadius: 12, border: "none",
            background: "#e8527a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
          onClick={syncAll}
        >
          ✨ 전체 {pendingCount}건 장부에 반영
        </button>
      )}

      {allDone && (
        <div style={{ textAlign: "center", padding: 8, fontSize: 12, color: "#4CAF50" }}>
          ✅ 모든 결제 내역이 장부에 반영되었습니다
        </div>
      )}
    </div>
  );
}
