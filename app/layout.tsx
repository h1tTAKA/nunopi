import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DARK_MODE_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
