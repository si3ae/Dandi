"use client";
import { useEffect, useState } from "react";
import {
  Settings,
  TaxAlertLevel,
  TAX_ALERT_DAYS,
  loadSettings,
  saveSettings,
} from "@/lib/storage";

const LEVELS: { value: TaxAlertLevel; label: string; sub: string }[] = [
  { value: "minimal", label: "최소", sub: "1주·1일 전" },
  { value: "normal", label: "보통", sub: "1달·2주·1주·3일·1일 전" },
  { value: "thorough", label: "꼼꼼히", sub: "1달·3주·2주·1주·5일·3일·2일·1일 전" },
];

interface Props {
  onChanged?: (s: Settings) => void;
}

export default function AlertSettings({ onChanged }: Props) {
  const [settings, setSettings] = useState<Settings>({
    alertTaxDeadline: true,
    taxAlertLevel: "normal",
    alertExpenseSpike: true,
    alertDongbaekAuto: false,
  });

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    onChanged?.(next);
  }

  return (
    <div className="card">
      <div className="ct">⚙ 알림 설정</div>

      {/* 세무 마감 알림 — 마스터 토글 + 강도 선택 */}
      <div style={{ paddingBottom: 12, borderBottom: "0.5px solid #f0f0f0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0 6px",
            fontSize: 13,
          }}
        >
          <span>세무 마감 알림</span>
          <Toggle on={settings.alertTaxDeadline} onClick={() => update({ alertTaxDeadline: !settings.alertTaxDeadline })} />
        </div>

        {settings.alertTaxDeadline && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 8 }}>알림 강도</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {LEVELS.map((lv) => {
                const active = settings.taxAlertLevel === lv.value;
                return (
                  <button
                    key={lv.value}
                    onClick={() => update({ taxAlertLevel: lv.value })}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: active ? "1.5px solid #c084fc" : "0.5px solid #ddd",
                      background: active ? "#f8f5ff" : "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#222" }}>
                        {lv.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{lv.sub}</div>
                    </div>
                    {active && <span style={{ color: "#b07ae8", fontSize: 16 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 8, lineHeight: 1.5 }}>
              선택된 시점에 단디가 마감일 알림을 보냅니다. (총 {TAX_ALERT_DAYS[settings.taxAlertLevel].length}회)
            </div>
          </div>
        )}
      </div>

      {/* 그 외 토글 — 아직 실제 동작 로직이 연결되지 않음 */}
      <Row
        label="지출 급증 경보"
        badge="준비중"
        on={settings.alertExpenseSpike}
        onClick={() => {}}
        disabled
      />
      <Row
        label="동백전 자동기록 알림"
        badge="준비중"
        on={settings.alertDongbaekAuto}
        onClick={() => {}}
        disabled
        last
      />
    </div>
  );
}

function Row({
  label,
  on,
  onClick,
  last,
  badge,
  disabled,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  last?: boolean;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        fontSize: 13,
        borderBottom: last ? "none" : "0.5px solid #f0f0f0",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {label}
        {badge && (
          <span
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 8,
              background: "#f3eefa",
              color: "#a855f7",
              fontWeight: 600,
            }}
          >
            {badge}
          </span>
        )}
      </span>
      <Toggle on={disabled ? false : on} onClick={disabled ? () => {} : onClick} />
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 38,
        height: 22,
        background: on ? "#c084fc" : "#ddd",
        borderRadius: 11,
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: on ? 19 : 3,
          width: 16,
          height: 16,
          background: "#fff",
          borderRadius: "50%",
          transition: "left 0.2s",
        }}
      />
    </div>
  );
}
