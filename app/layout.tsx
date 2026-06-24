import type { Metadata } from "next";
import { Inter, Space_Grotesk, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// PDF 디자인 시스템 타이포: Inter(본문/long-form), Space Grotesk(헤딩/UI 라틴),
// Noto Sans KR(한글). 코드(--font-mono)는 유저 요청대로 제외 — 기존 mono 스택 유지.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: DARK_MODE_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
