import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
