import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Space_Grotesk, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// PDF 디자인 시스템 타이포: Inter(본문/long-form), Space Grotesk(헤딩/UI 라틴),
// Noto Sans KR(한글). 코드(--font-mono)는 유저 요청대로 제외 — 기존 mono 스택 유지.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  // next/font의 Noto_Sans_KR named subset은 latin/cyrillic 등뿐 — 한글 글리프는
  // 별도 subset이 아니라 unicode-range 블록으로 항상 @font-face에 포함된다.
  // subsets는 preload 대상만 제어. 한글 글리프 용량이 커서 preload는 끄고 swap.
  subsets: ["latin"],
  preload: false,
  variable: "--font-noto",
  display: "swap",
});

const DARK_MODE_SCRIPT = `(function(){try{var t=localStorage.getItem('nunopi:theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t?t==='dark':d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Nunopi",
  description:
    "바이브코더를 위한 AI 코드 학습 도구. 코드를 붙여넣으면 줄별 설명, 토큰 사전, 개념 정리를 만들어준다.",
  openGraph: {
    title: "Nunopi",
    description: "바이브코더를 위한 AI 코드 학습 도구",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: "Nunopi",
    description: "바이브코더를 위한 AI 코드 학습 도구",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`h-full antialiased ${inter.variable} ${spaceGrotesk.variable} ${notoSansKr.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* 다크모드 FOUC 방지 — 하이드레이션 전 실행. next/script beforeInteractive로 초기 HTML에 안전 주입(React 19 raw <script> 에러 회피). */}
        <Script id="nunopi-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: DARK_MODE_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
