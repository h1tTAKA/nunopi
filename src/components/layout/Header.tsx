"use client";

import { useState } from "react";

export default function Header() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("nunopi:theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Nunopi
        </span>
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
