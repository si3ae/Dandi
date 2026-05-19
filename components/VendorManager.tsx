"use client";
import { useEffect, useState } from "react";
import { Vendor, Entry, loadVendors, addVendor, deleteVendor, fmt, total } from "@/lib/storage";
import { thisMonthKST } from "@/lib/date";

interface Props {
  entries: Entry[];
}

const CATEGORIES = [
  { value: "식재료", emoji: "🥬" },
  { value: "음료", emoji: "🍺" },
  { value: "공과금", emoji: "💡" },
  { value: "통신비", emoji: "📱" },
  { value: "임차료", emoji: "🏪" },
  { value: "기타", emoji: "📦" },
];

export default function VendorManager({ entries }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("식재료");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setVendors(loadVendors());
  }, []);

  function refresh() {
    setVendors(loadVendors());
  }

  function onAdd() {
    if (!name.trim()) {
      setMsg("⚠ 거래처 이름을 입력하세요");
      return;
    }
    const cat = CATEGORIES.find((c) => c.value === category);
    addVendor({
      name: name.trim(),
      category,
      emoji: cat?.emoji || "📦",
    });
    setName("");
    refresh();
    setMsg(`✅ ${name}이(가) 추가되었습니다`);
    setTimeout(() => setMsg(""), 3000);
  }

  function onDelete(id: string, name: string) {
    if (confirm(`'${name}'을(를) 삭제할까요?`)) {
      deleteVendor(id);
      refresh();
    }
  }

  // 거래처별 거래액 집계
  function getStats(vendorName: string) {
    const matched = entries.filter((e) => e.vendor === vendorName);
    const totalAmt = matched.reduce((s, e) => {
      return s + (e.type === "in" ? total(e) : -total(e));
    }, 0);
    return { count: matched.length, totalAmt };
  }

  // 이번 달 거래된 거래처 수 (KST 기준)
  const thisMonth = thisMonthKST();
  const activeVendorNames = new Set(
    entries.filter((e) => e.date.startsWith(thisMonth)).map((e) => e.vendor).filter(Boolean)
  );

  return (
    <>
      <div className="sc2">
        <div className="sv">
          <div className="sl">거래처 수</div>
          <div className="sa">{vendors.length}곳</div>
        </div>
        <div className="sv">
          <div className="sl">이번달 거래</div>
          <div className="sa" style={{ color: "#b07ae8" }}>{activeVendorNames.size}곳</div>
        </div>
      </div>

      <div className="card">
        <div className="ct">➕ 거래처 추가</div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="거래처 이름"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "0.5px solid #ddd",
            fontSize: 13,
            marginBottom: 8,
            background: "#f8f7fb",
          }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "0.5px solid #ddd",
            fontSize: 13,
            marginBottom: 8,
            background: "#f8f7fb",
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.emoji} {c.value}
            </option>
          ))}
        </select>
        <button className="btn-p" style={{ width: "100%" }} onClick={onAdd}>
          추가하기
        </button>
        {msg && (
          <div className={msg.startsWith("⚠") ? "err-msg" : "new-entry"} style={{ marginTop: 6 }}>
            {msg}
          </div>
        )}
      </div>

      <div className="card">
        <div className="ct">🏪 거래처 목록</div>
        {vendors.length === 0 ? (
          <div style={{ fontSize: 14, color: "#999", padding: 10, textAlign: "center" }}>
            거래처가 없습니다
          </div>
        ) : (
          vendors.map((v) => {
            const stats = getStats(v.name);
            return (
              <div
                key={v.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "0.5px solid #f0f0f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#f3eefa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    {v.emoji || "📦"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ei">{v.name}</div>
                    <div className="ed">
                      {v.category} · 거래 {stats.count}회
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {stats.totalAmt !== 0 && (
                    <span
                      className="amt"
                      style={{ color: stats.totalAmt > 0 ? "#4CAF50" : "#f472b6" }}
                    >
                      {stats.totalAmt > 0 ? "+" : ""}
                      {fmt(stats.totalAmt)}
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(v.id, v.name)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#bbb",
                      cursor: "pointer",
                      fontSize: 16,
                      padding: 4,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
