"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import type { Screen } from "@/lib/types";

export default function Home({ onGo }: { onGo: (s: Screen) => void }) {
  const [userName, setUserName] = useState("사장");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("dandi_user_name");
      if (saved) setUserName(saved);
    } catch {}
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* 유저 바 */}
      <div style={{background:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 20px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icons/profile-avatar.png" alt="" style={{width:40,height:40,borderRadius:"50%",objectFit:"cover"}} />
            <span style={{fontSize:16,fontWeight:600}}>{userName} 님</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icons/profile-heart.png" alt="" style={{width:32,height:32,borderRadius:"50%",objectFit:"cover"}} />
            <img src="/icons/bell.png" alt="" style={{width:30,height:30,objectFit:"contain"}} />
            <img src="/icons/menu.png" alt="" style={{width:30,height:30,objectFit:"contain"}} />
          </div>
        </div>
      </div>

      <div style={{background:"#f5f5f8",paddingTop:2}}>
        {/* 동백전 카드 */}
        <div style={{margin:"0 16px 14px",background:"#fff",borderRadius:20,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <img src="/icons/dongbaek-logo.png" alt="" style={{width:28,height:28,borderRadius:8,objectFit:"cover"}} />
              <span style={{fontSize:15,fontWeight:700}}>동백전</span>
            </div>
            <div style={{display:"flex",gap:14,fontSize:13,color:"#666",alignItems:"center"}}>
              <span style={{display:"flex",alignItems:"center",gap:4}}><img src="/icons/scan.png" alt="" style={{width:18,height:18}} /> QR결제</span>
              <span style={{borderLeft:"1px solid #eee",paddingLeft:14,display:"flex",alignItems:"center",gap:4}}><img src="/icons/qr.png" alt="" style={{width:18,height:18}} /> 가맹점찾기</span>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:15,color:"#555",fontWeight:500}}>⊕ 크게보기</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:14,height:14,borderRadius:"50%",background:"#eee",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#999"}}>?</span>
              <span style={{fontSize:26,fontWeight:700}}>156,000</span>
              <span style={{fontSize:18,color:"#666"}}>원</span>
              <span style={{width:30,height:30,borderRadius:"50%",border:"1px solid #ddd",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:19,color:"#999"}}>↻</span>
            </div>
          </div>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,paddingTop:12}}>
              <span style={{fontSize:14,fontWeight:600,flexShrink:0}}>동백패스</span>
              <div style={{flex:1,height:8,borderRadius:4,background:"#eef3f8",position:"relative"}}>
                <div style={{width:"65%",height:"100%",borderRadius:4,background:"linear-gradient(90deg,#6cb4ee,#a78bfa)"}} />
                <div style={{position:"absolute",left:"calc(65% - 10px)",top:-16,fontSize:16}}>🚌</div>
              </div>
            </div>
            <div style={{textAlign:"right",fontSize:13,color:"#666"}}>환급 예정금액 <b>24,000</b> 원</div>
          </div>
          <div style={{textAlign:"center",marginTop:10,fontSize:18,color:"#ccc"}}>⌵</div>
        </div>

        {/* 걷기 카드 */}
        <div style={{margin:"0 16px 14px",background:"linear-gradient(180deg,#fff 50%,#fce8ef 100%)",borderRadius:20,padding:"24px 20px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",position:"relative",overflow:"hidden",minHeight:260}}>
          <button aria-label="이전" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.9)",border:"1px solid #eee",color:"#666",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",padding:0,lineHeight:1}}>‹</button>
          <button aria-label="다음" style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.9)",border:"1px solid #eee",color:"#666",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",padding:0,lineHeight:1}}>›</button>
          <div style={{position:"relative",zIndex:1}}>
            <div style={{fontSize:16,lineHeight:1.4}}>오늘의 걷기 목표를<br />달성했군요!</div>
            <div style={{marginTop:8,fontSize:14,color:"#e8527a",fontWeight:500}}>포인트 받기 &gt;</div>
          </div>
          <img src="/icons/dongbaek-char2.png" alt="" style={{position:"absolute",right:50,top:60,height:160,width:"auto",objectFit:"contain"}} />
          <div style={{position:"relative",zIndex:1,marginTop:50}}>
            <div style={{fontSize:15,fontWeight:700}}>오늘의 걷기 ⓘ</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:4}}>
              <span style={{fontSize:32,fontWeight:700}}>8,001</span>
              <span style={{fontSize:17,color:"#666",fontWeight:700}}>걸음</span>
            </div>
          </div>
          <div style={{position:"relative",zIndex:1,textAlign:"center",marginTop:14,display:"flex",gap:6,justifyContent:"center"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#ddd"}} />
            <div style={{width:6,height:6,borderRadius:"50%",background:"#ddd"}} />
            <div style={{width:6,height:6,borderRadius:"50%",background:"#444"}} />
          </div>
        </div>

        {/* 메뉴 그리드 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:10,margin:"0 16px 10px"}}>
          <div style={{background:"#fff",borderRadius:20,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.04)",gridRow:"1/3",position:"relative",display:"flex",flexDirection:"column"}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#666"}}>MY</div>
              <div style={{fontSize:15,fontWeight:700,color:"#666",marginTop:2}}>플랫폼</div>
            </div>
            <img src="/icons/wallet.png" alt="" style={{width:35,height:35,position:"absolute",right:16,bottom:16}} />
          </div>
          <div style={{background:"#fff",borderRadius:20,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:15,fontWeight:700,color:"#666"}}>정책자금</div><div style={{fontSize:15,fontWeight:700,color:"#666"}}>신청</div></div>
            <img src="/icons/coin.png" alt="" style={{width:25,height:25,objectFit:"contain"}} />
          </div>
          <div style={{background:"#fff",borderRadius:20,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:15,fontWeight:700,color:"#666"}}>15분도시</div><div style={{fontSize:15,fontWeight:700,color:"#666"}}>공유공동체</div></div>
            <div style={{fontSize:18,fontWeight:700,color:"#e8527a"}}>15</div>
          </div>
        </div>

        {/* 단디 카드 */}
        <div onClick={() => onGo("voice")} style={{margin:"4px 16px 20px",background:"#ffffff",borderRadius:12,padding:20,boxShadow:"0 2px 5px rgba(0,0,0,0.05)",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",position:"relative",overflow:"hidden",minHeight:140}}>
          <div style={{position:"relative",zIndex:1,maxWidth:"60%"}}>
            <div style={{fontSize:20,fontWeight:700,color:"#e8527a",marginBottom:4}}>단디</div>
            <div style={{fontSize:15,fontWeight:600,color:"#333",marginBottom:6}}>AI 장부 비서</div>
            <div style={{fontSize:12,color:"#999",lineHeight:1.4}}>음성·영수증·세금계산서 자동 입력</div>
          </div>
          <img src="/icons/dandi-banner.png" alt="" style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",height:135,width:"auto",objectFit:"contain"}} />
        </div>
      </div>
    </>
  );
}
