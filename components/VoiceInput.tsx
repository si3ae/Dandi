"use client";
import { useRef, useState } from "react";
import { Entry, addEntries, fmt, splitSupplyVat, total } from "@/lib/storage";
import { todayKST } from "@/lib/date";
import { lookupCache, logCacheEvent, registerToCache } from "@/lib/txCache";
import { logUsage } from "@/lib/logging";

interface Props {
  onAdded: () => void;
}

export default function VoiceInput({ onAdded }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Omit<Entry, "id">[]>([]);
  const [error, setError] = useState("");

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function startRecording() {
    setError("");
    setText("");
    setParsed([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        await sendToWhisper(blob);
      };
      mr.start();
      mediaRecorder.current = mr;
      setRecording(true);
    } catch (e: any) {
      setError("마이크 권한이 필요합니다: " + e.message);
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
  }

  const [cacheHit, setCacheHit] = useState(false);
  const [lastLogId, setLastLogId] = useState<string | null>(null);

  async function sendToWhisper(blob: Blob) {
    setBusy(true);
    setCacheHit(false);
    setLastLogId(null);
    const startTime = Date.now();
    let cacheAction: "hit" | "miss" | "none" = "none";
    let cacheMatchedAccount: string | undefined;
    try {
      const fd = new FormData();
      fd.append("audio", new File([blob], "voice.webm", { type: "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "전사 실패");
      const transcribedText = data.text || "";
      setText(transcribedText);

      // AI 파싱 결과를 엔트리로 변환
      const entries: Omit<Entry, "id">[] = (data.items || []).map((e: any) => {
        const totalAmt = Number(e.total) || 0;
        const vendor = e.vendor || "";
        const account = e.account || (e.type === "in" ? "매출" : "기타");

        if (vendor) {
          const cached = lookupCache(vendor, totalAmt);
          if (cached) {
            setCacheHit(true);
            cacheAction = "hit";
            cacheMatchedAccount = cached.account;
            logCacheEvent("hit", vendor, totalAmt, "voice", cached.account);
            const { supply, vat } = splitSupplyVat(totalAmt, true);
            return {
              date: e.date || todayKST(),
              account: cached.account,
              description: cached.description,
              vendor: cached.vendor,
              type: cached.type,
              supply, vat,
              evidence: (cached.evidence || "none") as Entry["evidence"],
              source: "voice" as const,
            };
          }
          cacheAction = "miss";
          logCacheEvent("miss", vendor, totalAmt, "voice");
        }

        const { supply, vat } = splitSupplyVat(totalAmt, true);
        return {
          date: e.date || todayKST(),
          account,
          description: e.description || "내역",
          vendor,
          type: e.type === "in" ? "in" : "out",
          supply, vat,
          evidence: e.evidence || "none",
          source: "voice" as const,
        };
      });
      setParsed(entries);

      // 사용 로그 자동 기록
      logUsage({
        source: "voice",
        whisperText: transcribedText,
        parsedJson: data.items,
        cacheAction,
        cacheMatchedAccount,
        durationMs: Date.now() - startTime,
        success: true,
      }).then((id) => { if (id) setLastLogId(id); });

    } catch (e: any) {
      setError(e.message);
      logUsage({ source: "voice", durationMs: Date.now() - startTime, success: false, errorMessage: e.message });
    } finally {
      setBusy(false);
    }
  }

  function commit() {
    if (parsed.length === 0) return;
    // 확인된 거래를 캐시에 등록
    parsed.forEach((e) => {
      if (e.vendor && e.account) {
        registerToCache(e.vendor, (e.supply||0)+(e.vat||0), e.account, e.type, e.description, e.evidence||"none");
      }
    });
    addEntries(parsed);
    setParsed([]);
    setText("");
    setCacheHit(false);
    onAdded();
  }

  return (
    <div className="card">
      <div className="ct">🎙 음성으로 장부 입력</div>
      <div className={"vbox" + (text ? " filled" : "")}>
        {busy
          ? "🐔 단디: 분석 중이데이~ 🤔"
          : recording
          ? "듣고 있데이~ 🎤"
          : text || "마이크 버튼을 눌러 말해보세요..."}
      </div>

      {parsed.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {cacheHit && (
            <div style={{ fontSize: 11, color: "#4A90E2", padding: "4px 8px", background: "#f0f7ff", borderRadius: 6, marginBottom: 6 }}>
              ⚡ 이전 패턴으로 자동 분류됨 (AI 호출 절감)
            </div>
          )}
          {parsed.map((e, i) => (
            <div key={i} className="entry">
              <div>
                <div className="ei">{e.description}</div>
                <div className="ed">
                  {e.date} · {e.account}
                  {e.vendor ? ` · ${e.vendor}` : ""}
                </div>
              </div>
              <div className="amt" style={{ color: e.type === "in" ? "#4CAF50" : "#f472b6" }}>
                {e.type === "in" ? "+" : "-"}
                {fmt(total(e as Entry))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="brow">
        {!recording ? (
          <button className="btn-p" onClick={startRecording} disabled={busy}>
            🎤 말하기
          </button>
        ) : (
          <button className="btn-p" onClick={stopRecording}>
            ⏹ 정지
          </button>
        )}
        <button className="btn-g" onClick={commit} disabled={parsed.length === 0 || busy}>
          ✨ 장부 추가 {parsed.length > 0 && `(${parsed.length})`}
        </button>
      </div>

      {error && <div className="err-msg">⚠ {error}</div>}
      {!error && parsed.length === 0 && text && !busy && (
        <div className="ai-msg">🐔 단디: 거래 내역을 못 찾았데이. 다시 말해줄래?</div>
      )}
    </div>
  );
}
