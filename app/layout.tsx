import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "단디 — AI 장부 비서",
  description: "부산 사투리 음성·손글씨·영수증을 이해하는 AI 장부 비서",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale/userScalable 지정하지 않음 — 시니어 사용자가 핀치 줌으로
  // 글자를 키울 수 있어야 합니다 (WCAG 1.4.4 Resize Text).
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
