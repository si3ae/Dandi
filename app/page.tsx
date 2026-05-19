"use client";
import { useEffect, useState } from "react";
import { Entry, loadEntries, saveEntries, loadVendors, saveVendors } from "@/lib/storage";
import { syncOnLoad } from "@/lib/sync";
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
    const local = loadEntries();
    setEntries(local);
    // 서버 동기화 (Supabase 설정 시)
    syncOnLoad(local, loadVendors(), (restoredEntries, restoredVendors) => {
      // 서버에서 복원된 데이터로 localStorage 교체
      saveEntries(restoredEntries);
      saveVendors(restoredVendors);
      setEntries(restoredEntries);
    });
  }, []);

  // 탭 전환 시 최신 데이터 로드
  useEffect(() => {
    setEntries(loadEntries());
  }, [screen]);

  // 동의 여부 — mounted 전에는 아무것도 안 그림 (깜빡임 방지)
  const [mounted, setMounted] = useState(false);
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setAgreed(!!localStorage.getItem("dandi_consent_v1"));
    }
    setMounted(true);
  }, []);

  function handleConsent() {
    localStorage.setItem("dandi_consent_v1", new Date().toISOString());
    setAgreed(true);
  }

  // 모든 화면 전환에서 동의 체크
  function go(s: Screen) {
    setScreen(s);
  }

  if (!mounted) {
    return <div className="phone"><div className="screen" /></div>;
  }

  return (
    <div className="phone">
      <StatusBar />
      {!agreed && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999, background: "#f5f5f5", overflow: "auto",
        }}>
          <ConsentScreen onAgree={handleConsent} onBack={() => {}} />
        </div>
      )}
      <div className={"screen" + (screen === "home" ? " no-tab" : "")}>
        {screen === "home" && <Home onGo={go} />}
        {(screen === "voice" ||
          screen === "handwriting" ||
          screen === "receipt" ||
          screen === "taxinvoice") && (
          <InputScreen screen={screen} entries={entries} onGo={go} onRefresh={refresh} />
        )}
        {screen === "report" && <Report entries={entries} onGo={go} />}
        {screen === "ganpyeon" && (
          <>
            <GradientHeader title="신고용 장부" sub="국세청 간편장부 양식" onBack={() => go("home")} />
            <div style={{ height: 8 }} />
            <GanpyeonView entries={entries} onChanged={refresh} />
          </>
        )}
        {screen === "vendors" && (
          <>
            <GradientHeader title="거래처 관리" sub="자주 쓰는 거래처 등록" onBack={() => go("home")} />
            <div style={{ height: 8 }} />
            <VendorManager entries={entries} />
          </>
        )}
        {screen === "alert" && <Alert onGo={go} />}
      </div>
      {agreed && screen !== "home" && (
        <div className="tabbar">
          <button className={"tab" + (tabIdx[screen] === 0 ? " on" : "")} onClick={() => go("home")}>
            <div className="ti">🏠</div>홈
          </button>
          <button className={"tab" + (tabIdx[screen] === 1 ? " on" : "")} onClick={() => go("voice")}>
            <div className="ti">✏️</div>입력
          </button>
          <button className={"tab" + (tabIdx[screen] === 2 ? " on" : "")} onClick={() => go("report")}>
            <div className="ti">📊</div>리포트
          </button>
          <button className={"tab" + (tabIdx[screen] === 3 ? " on" : "")} onClick={() => go("ganpyeon")}>
            <div className="ti">📋</div>신고
          </button>
          <button className={"tab" + (tabIdx[screen] === 4 ? " on" : "")} onClick={() => go("alert")}>
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
      <GradientHeader title="체험 안내 및 동의" sub="단디 사용 전 확인" onBack={onBack} />
      <div style={{ height: 8 }} />
      <div className="card" style={{ lineHeight: 1.7, fontSize: 12, color: "#333" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>단디 체험 데이터 처리 안내</div>

        <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 10px", marginBottom: 12, fontSize: 11, color: "#b8860b" }}>
          🔶 본 서비스는 전시 체험용이며, 체험 과정에서 아래와 같이 데이터가 수집됩니다.
        </div>

        <div style={{ marginBottom: 10 }}>
          <b>1. 수집 항목</b><br />
          · 음성 입력 시: AI가 변환한 텍스트(음성 원본은 저장하지 않음)<br />
          · 사진 입력 시: AI가 인식한 텍스트 결과<br />
          · AI 분류 결과 (계정과목, 금액, 거래처)<br />
          · 캐시 적중 여부 및 응답 소요 시간<br />
          · 오류 신고 내용 (신고 시에만)
        </div>

        <div style={{ marginBottom: 10 }}>
          <b>2. 수집하지 않는 항목</b><br />
          · 이름, 연락처, 위치 등 개인 식별 정보<br />
          · 음성 원본 파일 (AI 변환 후 즉시 파기)<br />
          · 촬영 원본 이미지 (AI 인식 후 즉시 파기)
        </div>

        <div style={{ marginBottom: 10 }}>
          <b>3. 수집 목적</b><br />
          · 부산 사투리 음성 인식 정확도 분석<br />
          · AI 장부 분류 성능 개선 연구<br />
          · 소상공인 디지털 전환 실증 보고서 작성
        </div>

        <div style={{ marginBottom: 10 }}>
          <b>4. 보관 및 파기</b><br />
          · 수집된 데이터는 전시 종료 후 <b>6개월 이내</b>에 파기합니다.<br />
          · 연구 목적으로 활용 시 개인 식별이 불가능한 형태로 가공하여 사용합니다.
        </div>

        <div style={{ marginBottom: 12 }}>
          <b>5. 기기 내 데이터</b><br />
          · 장부 데이터는 이 기기의 브라우저에 저장되며, 체험 종료 후 브라우저 데이터를 삭제하면 완전히 제거됩니다.
        </div>

        <button
          style={{
            width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
            background: "#e8527a", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}
          onClick={onAgree}
        >
          동의하고 체험하기
        </button>
        <button
          style={{
            width: "100%", padding: "10px 0", marginTop: 6, borderRadius: 12,
            border: "1px solid #ddd", background: "#fff", color: "#999",
            fontSize: 13, cursor: "pointer",
          }}
          onClick={onBack}
        >
          동의하지 않음
        </button>
        <div style={{ fontSize: 10, color: "#aaa", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
          동의하지 않으면 체험이 제한됩니다.<br />
          문의: sinetheta13@gmail.com
        </div>
      </div>
    </>
  );
}
