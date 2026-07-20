"use client";
import { useState } from "react";
import type { Screen } from "@/lib/types";
import { Entry, fmt, sumExpense, sumIncome, total, generateInsights } from "@/lib/storage";
import GradientHeader from "@/components/GradientHeader";
import WeekdayChart from "@/components/WeekdayChart";

export default function Report({ entries, onGo }: { entries: Entry[]; onGo: (s: Screen) => void }) {
  const [tab, setTab] = useState<"month" | "year">("month");
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);

  const filtered = entries.filter((e) => {
    const [y, m] = e.date.split("-").map(Number);
    if (tab === "month") return y === selYear && m === selMonth;
    return y === selYear;
  });

  // 선택한 연도에서 데이터가 있는 월 Set
  const monthsWithData = new Set(
    entries.filter((e) => Number(e.date.split("-")[0]) === selYear)
      .map((e) => Number(e.date.split("-")[1]))
  );

  const inc = sumIncome(filtered);
  const exp = sumExpense(filtered);
  const net = inc - exp;

  const byAccount = new Map<string, number>();
  filtered.filter((e) => e.type === "out").forEach((e) => {
    const k = e.account || "기타";
    byAccount.set(k, (byAccount.get(k) || 0) + total(e));
  });
  const accountList = Array.from(byAccount.entries()).sort((a, b) => b[1] - a[1]);

  const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!));

 const handlePdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = filtered.map((e) =>
      `<tr><td>${esc(e.date || "")}</td><td>${esc(e.description || "")}</td><td>${esc(e.account || "")}</td><td style="text-align:right;color:${e.type === "in" ? "green" : "red"}">${e.type === "in" ? "+" : "-"}${fmt(total(e))}</td></tr>`
    ).join("");
    const incStr = inc > 0 ? `+${fmt(inc)}` : fmt(inc);
    const expStr = exp > 0 ? `-${fmt(exp)}` : fmt(exp);
    w.document.write(`<html><head><title>단디 리포트</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 8px;font-size:13px}th{background:#f5f5f5}</style></head><body><h2>단디 리포트 — ${tab === "month" ? selYear + "년 " + selMonth + "월" : selYear + "년"}</h2><p>수입: ${incStr} / 지출: ${expStr} / 순이익: ${fmt(net)}</p><table><tr><th>날짜</th><th>내용</th><th>계정</th><th>금액</th></tr>${rows}</table><script>window.print()</script></body></html>`);
    w.document.close();
  };

  const handleKakao = () => {
    const incStr = inc > 0 ? `+${fmt(inc)}` : fmt(inc);
    const expStr = exp > 0 ? `-${fmt(exp)}` : fmt(exp);
    const text = `[단디 리포트] ${tab === "month" ? selYear + "년 " + selMonth + "월" : selYear + "년"}\n수입: ${incStr}\n지출: ${expStr}\n순이익: ${fmt(net)}\n거래 ${filtered.length}건`;
    if (navigator.share) {
      navigator.share({ title: "단디 리포트", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => alert("클립보드에 복사됐어요! 카카오톡에 붙여넣기 하세요.")).catch(() => {});
    }
  };

  const years = Array.from(new Set(entries.map((e) => Number(e.date.split("-")[0])))).sort((a, b) => b - a);
  if (years.length === 0) years.push(now.getFullYear());

  return (
    <>
      <GradientHeader title="리포트" sub={tab === "month" ? "월별 분석" : "연별 분석"} onBack={() => onGo("home")} />
      <div style={{ height: 8 }} />

      <div style={{ display: "flex", gap: 8, margin: "0 16px 10px" }}>
        <button className={"inav" + (tab === "month" ? " on" : "")} onClick={() => setTab("month")}>📅 월별</button>
        <button className={"inav" + (tab === "year" ? " on" : "")} onClick={() => setTab("year")}>📊 연별</button>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "0 16px 10px", flexWrap: "wrap" }}>
        {years.map((y) => (
          <button key={y} className={"inav" + (selYear === y ? " on" : "")} onClick={() => setSelYear(y)}>{y}년</button>
        ))}
      </div>
      {tab === "month" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 16px 10px" }}>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
            <button key={m} className={"inav" + (selMonth === m ? " on" : "")} onClick={() => setSelMonth(m)} style={{ flex: "0 0 calc(16.66% - 5px)", minWidth: 0, position: "relative", opacity: monthsWithData.has(m) || selMonth === m ? 1 : 0.5 }}>
              {m}월
              {monthsWithData.has(m) && <span style={{position:"absolute",top:3,right:5,width:4,height:4,borderRadius:"50%",background: selMonth === m ? "#fff" : "#e8527a"}} />}
            </button>
          ))}
        </div>
      )}

      <div className="sc2">
        <div className="sv"><div className="sl">수입 <span style={{fontSize:10,color:"#bbb"}}>(부가세 포함)</span></div><div className="sa" style={{ color: "#2da85e" }}>{inc > 0 ? "+" : ""}{fmt(inc)}</div></div>
        <div className="sv"><div className="sl">지출 <span style={{fontSize:10,color:"#bbb"}}>(부가세 포함)</span></div><div className="sa" style={{ color: "#e8527a" }}>{exp > 0 ? "-" : ""}{fmt(exp)}</div></div>
      </div>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="ct" style={{ margin: 0 }}>순이익</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: net >= 0 ? "#4CAF50" : "#f472b6" }}>{net >= 0 ? "+" : ""}{fmt(net)}</div>
      </div>

      {(() => {
        const insights = generateInsights(entries);
        if (insights.length === 0) return null;
        const bgMap = { info: "#f0f4ff", warning: "#fff8f0", positive: "#f0faf4" };
        const colorMap = { info: "#4a6fa5", warning: "#c67030", positive: "#2d8a50" };
        return (
          <div className="card">
            <div className="ct">🤖 AI 조언</div>
            {insights.map((ins, i) => (
              <div key={i} style={{
                padding: "10px 12px", marginBottom: i < insights.length - 1 ? 8 : 0,
                borderRadius: 10, background: bgMap[ins.type], fontSize: 13,
                color: colorMap[ins.type], lineHeight: 1.5,
              }}>
                {ins.emoji} {ins.text}
              </div>
            ))}
          </div>
        );
      })()}

      <WeekdayChart entries={filtered} />

      <div className="card">
        <div className="ct">📊 계정과목별 지출</div>
        {accountList.length === 0 ? (
          <div style={{ fontSize: 14, color: "#999", padding: 10, textAlign: "center" }}>지출 내역이 없어요</div>
        ) : (
          accountList.map(([k, v]) => (
            <div key={k} className="entry">
              <div className="ei">{k}</div>
              <div className="amt" style={{ color: "#e8527a" }}>-{fmt(v)} <span style={{ fontSize: 11, color: "#999" }}>{exp > 0 ? Math.round((v / exp) * 100) : 0}%</span></div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="ct">📒 내역 ({filtered.length}건)</div>
        {filtered.slice().reverse().map((e) => (
          <div key={e.id} className="entry">
            <div><div className="ei">{e.description}</div><div className="ed">{e.date} · {e.account} · {e.source || "수동"}</div></div>
            <div className="amt" style={{ color: e.type === "in" ? "#4CAF50" : "#f472b6" }}>{e.type === "in" ? "+" : "-"}{fmt(total(e))}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, margin: "10px 16px 20px" }}>
        <button onClick={handlePdf} style={{ flex: 1, padding: "14px 0", borderRadius: 14, border: "none", background: "#e8527a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>📄 PDF 내보내기</button>
        <button onClick={handleKakao} style={{ flex: 1, padding: "14px 0", borderRadius: 14, border: "none", background: "#FEE500", color: "#3C1E1E", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>💬 카카오톡 공유</button>
      </div>
    </>
  );
}
