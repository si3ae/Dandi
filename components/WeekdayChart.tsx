"use client";
import { Entry, sumByWeekday, fmt } from "@/lib/storage";

interface Props {
  entries: Entry[];
}

const LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default function WeekdayChart({ entries }: Props) {
  const { income, expense } = sumByWeekday(entries);
  const max = Math.max(...income, ...expense, 1);
  const totalCount = entries.length;

  if (totalCount < 5) {
    return (
      <div className="card">
        <div className="ct">📊 요일별 매출 패턴</div>
        <div style={{ fontSize: 13, color: "#999", textAlign: "center", padding: "20px 0" }}>
          📉 데이터가 {totalCount}건뿐이에요.<br />
          5건 이상 쌓이면 요일별 패턴을 볼 수 있어요.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="ct">📊 요일별 매출 패턴</div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginTop: 12, marginBottom: 6 }}>
        {LABELS.map((label, i) => {
          const incH = (income[i] / max) * 90;
          const expH = (expense[i] / max) * 90;
          const hasData = income[i] > 0 || expense[i] > 0;
          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
                {hasData ? (
                  <>
                    <div
                      title={`수입 ${fmt(income[i])}`}
                      style={{
                        width: 14,
                        height: Math.max(incH, 4),
                        background: "#2da85e",
                        borderRadius: "3px 3px 0 0",
                        opacity: income[i] > 0 ? 1 : 0.15,
                      }}
                    />
                    <div
                      title={`지출 ${fmt(expense[i])}`}
                      style={{
                        width: 14,
                        height: Math.max(expH, 4),
                        background: "#e8527a",
                        borderRadius: "3px 3px 0 0",
                        opacity: expense[i] > 0 ? 1 : 0.15,
                      }}
                    />
                  </>
                ) : (
                  <div style={{ width: 30, height: 4, background: "#eee", borderRadius: 2 }} title="데이터 없음" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", fontSize: 11, color: "#999" }}>
        {LABELS.map((l) => (
          <span key={l} style={{ flex: 1, textAlign: "center" }}>
            {l}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 12, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#666" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#2da85e" }} />
          수입
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#666" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#e8527a" }} />
          지출
        </div>
      </div>

      {entries.length === 0 && (
        <div style={{ fontSize: 11, color: "#999", textAlign: "center", marginTop: 8 }}>
          데이터가 쌓이면 패턴이 나타납니다
        </div>
      )}
    </div>
  );
}
