import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nunopi",
  description: "개발을 잘 모르는 바이브코더들을 위한 눈높이 AI 코드 학습 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
