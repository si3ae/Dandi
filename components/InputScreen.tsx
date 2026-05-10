"use client";
import { useState } from "react";
import type { Screen } from "@/lib/types";
import { Entry, fmt, loadEntries, saveEntries, sumExpense, sumIncome, total } from "@/lib/storage";
import GradientHeader from "@/components/GradientHeader";
import VoiceInput from "@/components/VoiceInput";
import ImageOcr from "@/components/ImageOcr";

export default function InputScreen({
  screen,
  entries,
  onGo,
  onRefresh,
}: {
  screen: Screen;
  entries: Entry[];
  onGo: (s: Screen) => void;
  onRefresh: () => void;
}) {
  const inc = sumIncome(entries);
  const exp = sumExpense(entries);

  // 인라인 수정 상태
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmt, setEditAmt] = useState("");

  function startEdit(e: Entry) {
    setEditId(e.id);
    setEditDesc(e.description);
    setEditAmt(String(total(e)));
  }

  function saveEdit(e: Entry) {
    let changed = false;
    if (editDesc !== e.description) { e.description = editDesc; changed = true; }
    const newAmt = parseInt(editAmt.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(newAmt) && newAmt !== total(e)) {
      e.supply = Math.round(newAmt / 1.1);
      e.vat = newAmt - e.supply;
      changed = true;
    }
    if (changed) {
      const all = loadEntries();
      const idx = all.findIndex((x: Entry) => x.id === e.id);
      if (idx >= 0) {
        all[idx] = { ...e };
        saveEntries(all);
      }
      onRefresh();
    }
    setEditId(null);
  }

  return (
    <>
      <GradientHeader title="단디" sub="AI 장부 비서 · 부산 사투리 지원" onBack={() => onGo("home")} />
      <div style={{ height: 8 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "0 16px 12px" }}>
        <div className={"inav" + (screen === "voice" ? " on" : "")} onClick={() => onGo("voice")} style={{ textAlign: "center" }}>🎤 음성</div>
        <div className={"inav" + (screen === "handwriting" ? " on" : "")} onClick={() => onGo("handwriting")} style={{ textAlign: "center" }}>✍️ 손글씨</div>
        <div className={"inav" + (screen === "receipt" ? " on" : "")} onClick={() => onGo("receipt")} style={{ textAlign: "center" }}>🧾 영수증</div>
        <div className={"inav" + (screen === "taxinvoice" ? " on" : "")} onClick={() => onGo("taxinvoice")} style={{ textAlign: "center" }}>📄 세금계산서</div>
      </div>

      <div className="sc2">
        <div className="sv">
          <div className="sl">이번 달 수입</div>
          <div className="sa" style={{ color: "#2da85e" }}>
            {inc > 0 ? "+" : ""}{fmt(inc)}
          </div>
        </div>
        <div className="sv">
          <div className="sl">이번 달 지출</div>
          <div className="sa" style={{ color: "#e8527a" }}>
            {exp > 0 ? "-" : ""}{fmt(exp)}
          </div>
        </div>
      </div>

      {screen === "voice" && <VoiceInput onAdded={onRefresh} />}
      {screen === "handwriting" && <ImageOcr mode="handwriting" onAdded={onRefresh} />}
      {screen === "receipt" && <ImageOcr mode="receipt" onAdded={onRefresh} />}
      {screen === "taxinvoice" && <ImageOcr mode="taxinvoice" onAdded={onRefresh} />}

      <div className="card">
        <div className="ct">📒 최근 내역</div>
        {entries
          .slice(-8)
          .reverse()
          .map((e) => (
            <div key={e.id}>
              <div className="entry">
                <div style={{ flex: 1 }}>
                  <div className="ei">{e.description}</div>
                  <div className="ed">
                    {e.date} · {e.account}
                    {e.vendor ? ` · ${e.vendor}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="amt" style={{ color: e.type === "in" ? "#4CAF50" : "#f472b6" }}>
                    {e.type === "in" ? "+" : "-"}
                    {fmt(total(e))}
                  </div>
                  <button
                    style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 8,
                      border: "1px solid #ddd", background: "#fff", color: "#666",
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                    onClick={() => editId === e.id ? setEditId(null) : startEdit(e)}
                  >
                    {editId === e.id ? "닫기" : "수정"}
                  </button>
                </div>
              </div>
              {editId === e.id && (
                <div style={{ padding: "8px 0 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#999" }}>설명</label>
                    <input
                      value={editDesc}
                      onChange={(ev) => setEditDesc(ev.target.value)}
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 10,
                        border: "1px solid #ddd", fontSize: 14, marginTop: 2,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#999" }}>금액 (부가세 포함)</label>
                    <input
                      value={editAmt}
                      onChange={(ev) => setEditAmt(ev.target.value)}
                      type="number"
                      inputMode="numeric"
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 10,
                        border: "1px solid #ddd", fontSize: 14, marginTop: 2,
                        outline: "none",
                      }}
                    />
                  </div>
                  <button
                    onClick={() => saveEdit(e)}
                    style={{
                      padding: "10px 0", borderRadius: 10, border: "none",
                      background: "#e8527a", color: "#fff", fontSize: 14,
                      fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    저장
                  </button>
                </div>
              )}
            </div>
          ))}
        {entries.length === 0 && (
          <div style={{ fontSize: 14, color: "#999", padding: 10, textAlign: "center" }}>
            아직 내역이 없어요
          </div>
        )}
      </div>
    </>
  );
}
