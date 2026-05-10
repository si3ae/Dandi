"use client";
import { useMemo, useState } from "react";
import {
  Entry,
  fmt,
  total,
  sumIncomeSupply,
  sumIncomeVat,
  sumExpenseSupply,
  sumExpenseVat,
  toGanpyeonCSV,
  downloadCSV,
  deleteEntry,
} from "@/lib/storage";
import { thisMonthKST } from "@/lib/date";

interface Props {
  entries: Entry[];
  onChanged: () => void;
}

export default function GanpyeonView({ entries, onChanged }: Props) {
  const [month, setMonth] = useState<string>(() => thisMonthKST());

  const filtered = useMemo(
    () => entries.filter((e) => e.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date)),
    [entries, month]
  );

  const incSupply = sumIncomeSupply(filtered);
  const incVat = sumIncomeVat(filtered);
  const expSupply = sumExpenseSupply(filtered);
  const expVat = sumExpenseVat(filtered);
  const vatPayable = incVat - expVat; // 납부 예정 부가세

  function onExport() {
    const csv = toGanpyeonCSV(filtered);
    downloadCSV(`간편장부_${month}.csv`, csv);
  }

  function onDelete(id: string) {
    if (confirm("이 항목을 삭제할까요?")) {
      deleteEntry(id);
      onChanged();
    }
  }

  return (
    <>
      <div className="card">
        <div className="ct">📋 간편장부 (국세청 양식)</div>
        <div style={{ fontSize: 12, color: "#e8527a", lineHeight: 1.6, marginBottom: 10, background: "#fce8ef", borderRadius: 10, padding: "10px 12px" }}>
          ⚠️ 이 CSV는 <b>홈택스에 직접 업로드할 수 없습니다.</b><br />
          세무사에게 전달하거나, 국세청 간편장부 양식 엑셀에 옮겨 적는 용도입니다.
        </div>
        <div style={{ fontSize: 11, color: "#999", lineHeight: 1.6, marginBottom: 10 }}>
          국세청 간편장부 컬럼(일자·계정과목·거래내용·거래처·수입·비용)을 따릅니다. 엑셀에서 바로 열립니다.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 13, color: "#666" }}>조회 월:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 8,
              border: "0.5px solid #ddd",
              fontSize: 13,
            }}
          />
        </div>
        <button className="btn-p" style={{ width: "100%" }} onClick={onExport} disabled={filtered.length === 0}>
          📥 CSV 내보내기 ({filtered.length}건)
        </button>
      </div>

      <div className="card">
        <div className="ct">💰 월 합계</div>
        <div className="result-row">
          <span className="rl">수입 공급가액</span>
          <span style={{ color: "#2da85e" }}>{fmt(incSupply)}</span>
        </div>
        <div className="result-row">
          <span className="rl">수입 부가세</span>
          <span style={{ color: "#2da85e" }}>{fmt(incVat)}</span>
        </div>
        <div className="result-row">
          <span className="rl">비용 공급가액</span>
          <span style={{ color: "#e8527a" }}>{fmt(expSupply)}</span>
        </div>
        <div className="result-row">
          <span className="rl">비용 부가세 (매입세액)</span>
          <span style={{ color: "#e8527a" }}>{fmt(expVat)}</span>
        </div>
        <div
          className="result-row"
          style={{ borderTop: "1px solid #eee", marginTop: 6, paddingTop: 6, fontWeight: 600 }}
        >
          <span>납부 예정 부가세</span>
          <span style={{ color: vatPayable >= 0 ? "#f472b6" : "#4CAF50" }}>{fmt(vatPayable)}</span>
        </div>
        <div
          className="result-row"
          style={{ fontWeight: 600 }}
        >
          <span>소득금액 (수입−비용)</span>
          <span>{fmt(incSupply - expSupply)}</span>
        </div>
      </div>

      <div className="card" style={{ padding: "14px 8px" }}>
        <div className="ct" style={{ padding: "0 8px" }}>📒 간편장부 명세 ({filtered.length}건)</div>
        {filtered.length === 0 ? (
          <div style={{ fontSize: 14, color: "#999", padding: 14, textAlign: "center" }}>
            이 달 내역이 없습니다
          </div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <div style={{ fontSize: 10, color: "#bbb", textAlign: "right", marginBottom: 4 }}>← 좌우 스크롤 →</div>
            <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#faf6ff", color: "#666" }}>
                  <th style={th}>일자</th>
                  <th style={th}>거래내용</th>
                  <th style={{ ...th, color: "#2da85e" }}>수입(공급)</th>
                  <th style={{ ...th, color: "#e8527a" }}>비용(공급)</th>
                  <th style={th}>계정</th>
                  <th style={th}>VAT</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const isIncome = e.type === "in";
                  return (
                    <tr key={e.id} style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                      <td style={td}>{e.date.slice(5)}</td>
                      <td style={td}>{e.description}</td>
                      <td style={{ ...td, textAlign: "right", color: "#2da85e" }}>
                        {isIncome ? e.supply.toLocaleString() : ""}
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "#e8527a" }}>
                        {!isIncome ? e.supply.toLocaleString() : ""}
                      </td>
                      <td style={{ ...td, color: "#666" }}>{e.account || "-"}</td>
                      <td style={{ ...td, textAlign: "right", color: "#999" }}>
                        {e.vat ? e.vat.toLocaleString() : "-"}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <button
                          onClick={() => onDelete(e.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#bbb",
                            cursor: "pointer",
                            fontSize: 14,
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const th: React.CSSProperties = {
  padding: "8px 4px",
  fontSize: 11,
  fontWeight: 600,
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #eee",
};
const td: React.CSSProperties = {
  padding: "8px 4px",
  fontSize: 11,
  whiteSpace: "nowrap",
};
