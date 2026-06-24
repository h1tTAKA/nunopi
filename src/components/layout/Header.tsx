"use client";

import { useEffect, useState } from "react";

export default function Header() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("nunopi:theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("nunopi:theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111219]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* 브랜드 로고 lockup. 라이트=ink navy 워드마크(white 파일), 다크=흰 워드마크(transparent).
            (투명본은 흰 워드마크라 라이트에 두면 안 보임 — 테마별로 분기.) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/nunopi-lockup-white.png"
          alt="Nunopi"
          className="block h-8 w-auto dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/nunopi-lockup-transparent.png"
          alt="Nunopi"
          className="hidden h-8 w-auto dark:block"
        />
        <button
          type="button"
          onClick={toggleDark}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title={dark ? "라이트 모드" : "다크 모드"}
          aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
        >
          {dark ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
}
