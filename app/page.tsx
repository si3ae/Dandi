"use client";
import { useEffect, useState } from "react";
import { Entry, loadEntries } from "@/lib/storage";
import type { Screen } from "@/lib/types";
import StatusBar from "@/components/StatusBar";
import GradientHeader from "@/components/GradientHeader";
import Home from "@/components/Home";
import InputScreen from "@/components/InputScreen";
import Report from "@/components/Report";
import Alert from "@/components/Alert";
import GanpyeonView from "@/components/GanpyeonView";
import VendorManager from "@/components/VendorManager";

const tabIdx: Record<Screen, number> = {
  home: 0,
  voice: 1,
  handwriting: 1,
  receipt: 1,
  taxinvoice: 1,
  consent: 1,
  report: 2,
  ganpyeon: 3,
  vendors: 0,
  alert: 4,
};

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [entries, setEntries] = useState<Entry[]>([]);

  const refresh = () => setEntries(loadEntries());
  useEffect(() => {
    refresh();
  }, [screen]);

  // 단디 기능 최초 진입 시 동의 체크
  function goWithConsent(s: Screen) {
    if (typeof window !== "undefined" && !localStorage.getItem("dandi_consent_v1")) {
      if (s === "voice" || s === "handwriting" || s === "receipt" || s === "taxinvoice") {
        setScreen("consent");
        return;
      }
    }
    setScreen(s);
  }

  return (
    <div className="phone">
      <StatusBar />
      <div className={"screen" + (screen === "home" ? " no-tab" : "")}>
        {screen === "home" && <Home onGo={goWithConsent} />}
        {screen === "consent" && <ConsentScreen onAgree={() => setScreen("voice")} onBack={() => setScreen("home")} />}
        {(screen === "voice" ||
          screen === "handwriting" ||
          screen === "receipt" ||
          screen === "taxinvoice") && (
          <InputScreen screen={screen} entries={entries} onGo={setScreen} onRefresh={refresh} />
        )}
        {screen === "report" && <Report entries={entries} onGo={setScreen} />}
        {screen === "ganpyeon" && (
          <>
            <GradientHeader title="신고용 장부" sub="국세청 간편장부 양식" onBack={() => setScreen("home")} />
            <div style={{ height: 8 }} />
            <GanpyeonView entries={entries} onChanged={refresh} />
          </>
        )}
        {screen === "vendors" && (
          <>
            <GradientHeader title="거래처 관리" sub="자주 쓰는 거래처 등록" onBack={() => setScreen("home")} />
            <div style={{ height: 8 }} />
            <VendorManager entries={entries} />
          </>
        )}
        {screen === "alert" && <Alert onGo={setScreen} />}
      </div>
      {screen !== "home" && (
        <div className="tabbar">
          <button className={"tab" + (tabIdx[screen] === 0 ? " on" : "")} onClick={() => setScreen("home")}>
            <div className="ti">🏠</div>홈
          </button>
          <button className={"tab" + (tabIdx[screen] === 1 ? " on" : "")} onClick={() => setScreen("voice")}>
            <div className="ti">✏️</div>입력
          </button>
          <button className={"tab" + (tabIdx[screen] === 2 ? " on" : "")} onClick={() => setScreen("report")}>
            <div className="ti">📊</div>리포트
          </button>
          <button className={"tab" + (tabIdx[screen] === 3 ? " on" : "")} onClick={() => setScreen("ganpyeon")}>
            <div className="ti">📋</div>신고
          </button>
          <button className={"tab" + (tabIdx[screen] === 4 ? " on" : "")} onClick={() => setScreen("alert")}>
            <div className="ti">🔔</div>알림
          </button>
        </div>
      )}
    </div>
  );
}

function ConsentScreen({ onAgree, onBack }: { onAgree: () => void; onBack: () => void }) {
  return (
    <>
      <GradientHeader title="데이터 처리 안내" sub="단디 사용 전 확인" onBack={onBack} />
      <div style={{ height: 8 }} />
      <div className="card" style={{ lineHeight: 1.7, fontSize: 12, color: "#333" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>단디 데이터 처리 안내</div>
        <div style={{ marginBottom: 8 }}>
          <b>1. 기기 저장 원칙</b><br />
          사장님의 장부 데이터는 이 기기 안에만 저장됩니다.
        </div>
        <div style={{ marginBottom: 8 }}>
          <b>2. 외부 AI 호출</b><br />
          음성 인식 및 영수증 분석 시 음성·이미지가 일시적으로 전송됩니다. AI 학습에 사용되지 않으며 처리 즉시 파기됩니다.
        </div>
        <div style={{ marginBottom: 8 }}>
          <b>3. 반복 거래 캐싱</b><br />
          확인된 거래 패턴은 기기 내에 캐시하여 AI 호출을 줄입니다.
        </div>
        <div style={{ marginBottom: 12 }}>
          <b>4. 통계 데이터</b><br />
          현재 단계에서는 외부에 어떤 통계도 전송하지 않습니다.
        </div>
        <button
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
            background: "#e8527a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
          onClick={() => { localStorage.setItem("dandi_consent_v1", new Date().toISOString()); onAgree(); }}
        >
          동의하고 시작하기
        </button>
        <div style={{ fontSize: 10, color: "#aaa", textAlign: "center", marginTop: 6 }}>
          동의 내역은 기기에 저장되며, 브라우저 데이터 삭제 시 재동의가 필요합니다.
        </div>
      </div>
    </>
  );
}
