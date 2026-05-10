"use client";
import { useEffect, useState } from "react";

export default function StatusBar() {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 24px 8px",background:"#fff",flexShrink:0}}>
      <span style={{fontSize:15,fontWeight:600,minWidth:54}}>{time}</span>
      <div style={{width:126,height:34,background:"#000",borderRadius:20}}></div>
      <div style={{display:"flex",alignItems:"center",gap:5,minWidth:54,justifyContent:"flex-end"}}>
        <svg width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="8" width="3" height="4" rx="0.5" fill="#1a1a1a"/><rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="#1a1a1a"/><rect x="9" y="2" width="3" height="10" rx="0.5" fill="#1a1a1a"/><rect x="13.5" y="0" width="2.5" height="12" rx="0.5" fill="#1a1a1a"/></svg>
        <svg width="15" height="12" viewBox="0 0 15 12"><path d="M7.5 3.6C9.3 3.6 10.9 4.3 12 5.5L13.4 4.1C11.9 2.5 9.8 1.5 7.5 1.5S3.1 2.5 1.6 4.1L3 5.5C4.1 4.3 5.7 3.6 7.5 3.6Z" fill="#1a1a1a"/><path d="M7.5 6.7C8.7 6.7 9.7 7.2 10.5 7.9L11.9 6.5C10.7 5.4 9.2 4.7 7.5 4.7S4.3 5.4 3.1 6.5L4.5 7.9C5.3 7.2 6.3 6.7 7.5 6.7Z" fill="#1a1a1a"/><circle cx="7.5" cy="10.5" r="1.5" fill="#1a1a1a"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0" y="1" width="21" height="10" rx="2.5" stroke="#1a1a1a" strokeWidth="1" fill="none"/><rect x="22" y="4" width="2" height="4" rx="0.5" fill="#1a1a1a"/><rect x="1.5" y="2.5" width="18" height="7" rx="1.5" fill="#1a1a1a"/></svg>
      </div>
    </div>
  );
}
