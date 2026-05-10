"use client";
import { useEffect, useRef, useState } from "react";
import { Entry, addEntries, fmt, splitSupplyVat, total } from "@/lib/storage";
import { todayKST } from "@/lib/date";
import { registerToCache } from "@/lib/txCache";

type Mode = "handwriting" | "receipt" | "taxinvoice";

interface Props {
  mode: Mode;
  onAdded: () => void;
}

export default function ImageOcr({ mode, onAdded }: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);

  // 5MB 초과 이미지를 클라이언트에서 리사이즈
  async function resizeIfNeeded(file: File): Promise<File> {
    const MAX = 5 * 1024 * 1024;
    if (file.size <= MAX) return file;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.sqrt(MAX / file.size) * 0.9; // 약간 여유
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob!], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.85
        );
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleFile(file: File) {
    setError("");
    setResult(null);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const resized = await resizeIfNeeded(file);
      const fd = new FormData();
      fd.append("image", resized);
      fd.append("mode", mode);
      const res = await fetch("/api/ocr", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR 실패");
      if (!data.result || data.result.error) {
        setError("판독에 실패했습니다. 더 선명한 사진을 사용해 보세요.");
      } else {
        setResult(data.result);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (e.target) e.target.value = "";
  }

  function commit() {
    if (!result) return;
    const today = todayKST();

    if (mode === "handwriting" && Array.isArray(result)) {
      const entries: Omit<Entry, "id">[] = result.map((r: any) => {
        const totalAmt = Number(r.total) || 0;
        const { supply, vat } = splitSupplyVat(totalAmt, true);
        return {
          date: r.date || today,
          account: r.account || (r.type === "in" ? "매출" : "기타"),
          description: r.description || "내역",
          vendor: r.vendor || "",
          type: r.type === "in" ? "in" : "out",
          supply,
          vat,
          evidence: "none" as const,
          source: "handwriting" as const,
        };
      });
      addEntries(entries);
      entries.forEach((e) => { if (e.vendor && e.account) registerToCache(e.vendor, (e.supply||0)+(e.vat||0), e.account, e.type, e.description, e.evidence||"none"); });
    } else if (mode === "receipt") {
      const totalAmt = Number(result.total) || 0;
      // 영수증에 supply/vat가 직접 적혀 있으면 그대로, 아니면 자동 분리
      let supply = Number(result.supply) || 0;
      let vat = Number(result.vat) || 0;
      if (!supply && !vat && totalAmt) {
        const split = splitSupplyVat(totalAmt, true);
        supply = split.supply;
        vat = split.vat;
      }
      addEntries([
        {
          date: result.date || today,
          account: result.account || "기타",
          description: result.description || result.vendor || "영수증",
          vendor: result.vendor || "",
          type: "out",
          supply,
          vat,
          evidence: result.evidence || "simple_receipt",
          source: "receipt",
        },
      ]);
    } else if (mode === "taxinvoice") {
      const isBuy = result.type !== "sell";
      const supply = Number(result.supply) || 0;
      const vat = Number(result.vat) || 0;
      addEntries([
        {
          date: result.date || today,
          account: isBuy ? "매입" : "매출",
          description: result.description || (isBuy ? "세금계산서 매입" : "세금계산서 매출"),
          vendor: result.vendor || "",
          type: isBuy ? "out" : "in",
          supply,
          vat,
          evidence: "tax_invoice",
          source: "taxinvoice",
        },
      ]);
    }

    setResult(null);
    setPreview("");
    onAdded();
  }

  const titles: Record<Mode, { title: string; emoji: string }> = {
    handwriting: { title: "손글씨 장부 인식", emoji: "✍️" },
    receipt: { title: "영수증 스캔", emoji: "🧾" },
    taxinvoice: { title: "세금계산서 인식", emoji: "📄" },
  };

  return (
    <div className="card">
      <div className="ct">
        {titles[mode].emoji} {titles[mode].title}
      </div>

      {preview && <img src={preview} alt="preview" className="preview-img" />}

      {busy && (
        <div style={{ textAlign: "center", padding: 14, color: "#999", fontSize: 13 }}>
          🔍 Claude AI가 분석하고 있어요...
        </div>
      )}

      {result && !busy && <ResultView mode={mode} result={result} />}

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onPick}
      />

      <div className="brow">
        <button className="btn-p" onClick={() => setCameraOpen(true)} disabled={busy}>
          📷 카메라 촬영
        </button>
        <button className="btn-gray" onClick={() => galleryRef.current?.click()} disabled={busy}>
          🖼 갤러리 선택
        </button>
      </div>

      {result && !busy && (
        <button className="btn-g" style={{ width: "100%", marginTop: 10 }} onClick={commit}>
          장부에 추가하기
        </button>
      )}

      {error && <div className="err-msg">⚠ {error}</div>}

      {cameraOpen && (
        <CameraModal
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            handleFile(file);
          }}
        />
      )}
    </div>
  );
}

function CameraModal({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (e: any) {
        setError("카메라 접근 실패: " + e.message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      {error ? (
        <div style={{ color: "#fff", textAlign: "center", padding: 20 }}>
          <div style={{ marginBottom: 16 }}>⚠ {error}</div>
          <button className="btn-gray" onClick={onClose} style={{ flex: "none", padding: "10px 20px" }}>
            닫기
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", maxWidth: 360, borderRadius: 12, background: "#000" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 16, width: "100%", maxWidth: 360 }}>
            <button className="btn-gray" onClick={onClose} style={{ flex: 1 }}>
              취소
            </button>
            <button className="btn-p" onClick={capture} style={{ flex: 2 }}>
              📷 촬영
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResultView({ mode, result }: { mode: Mode; result: any }) {
  if (mode === "handwriting" && Array.isArray(result)) {
    return (
      <div className="result-box">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>✅ 인식 완료 — {result.length}건</div>
        {result.map((r: any, i: number) => (
          <div key={i} className="result-row">
            <span className="rl">
              {r.date} · {r.description}
            </span>
            <span style={{ color: r.type === "in" ? "#4CAF50" : "#f472b6", fontWeight: 600 }}>
              {r.type === "in" ? "+" : "-"}
              {fmt(Number(r.total) || 0)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (mode === "receipt") {
    const totalAmt = Number(result.total) || 0;
    let supply = Number(result.supply) || 0;
    let vat = Number(result.vat) || 0;
    if (!supply && !vat && totalAmt) {
      const s = splitSupplyVat(totalAmt, true);
      supply = s.supply;
      vat = s.vat;
    }
    return (
      <div className="result-box">
        <div className="result-row"><span className="rl">거래처</span><span style={{ fontWeight: 600 }}>{result.vendor}</span></div>
        <div className="result-row"><span className="rl">날짜</span><span>{result.date}</span></div>
        <div className="result-row"><span className="rl">계정과목</span><span>{result.account}</span></div>
        <div className="result-row"><span className="rl">공급가액</span><span>{fmt(supply)}</span></div>
        <div className="result-row"><span className="rl">부가세</span><span>{fmt(vat)}</span></div>
        <div className="result-row"><span className="rl">합계</span><span style={{ fontWeight: 600, color: "#e8527a" }}>-{fmt(totalAmt)}</span></div>
      </div>
    );
  }
  if (mode === "taxinvoice") {
    return (
      <div className="result-box">
        <div className="result-row"><span className="rl">공급자</span><span style={{ fontWeight: 600 }}>{result.vendor}</span></div>
        <div className="result-row"><span className="rl">날짜</span><span>{result.date}</span></div>
        <div className="result-row"><span className="rl">공급가액</span><span>{fmt(Number(result.supply) || 0)}</span></div>
        <div className="result-row"><span className="rl">VAT(10%)</span><span>{fmt(Number(result.vat) || 0)}</span></div>
        <div className="result-row"><span className="rl">합계</span><span style={{ fontWeight: 600, color: "#e8527a" }}>-{fmt(Number(result.total) || 0)}</span></div>
      </div>
    );
  }
  return null;
}
