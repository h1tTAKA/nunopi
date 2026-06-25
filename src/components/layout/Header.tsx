"use client";

import { IconSettings } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";

interface HeaderProps {
  // 헤더 정중앙 슬롯 — 코드/글 분석 모드 토글.
  modeToggle?: React.ReactNode;
  onOpenSettings: () => void;
}

export default function Header({ modeToggle, onOpenSettings }: HeaderProps) {
  const t = useT();
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-[#111219]/80">
      <div className="relative container mx-auto flex h-14 items-center justify-between px-4">
        {/* 브랜드 로고 lockup. 라이트=네이비 워드마크(투명), 다크=흰 워드마크(투명). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/nunopi-lockup-light.png"
          alt="Nunopi"
          className="block h-8 w-auto dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/nunopi-lockup-transparent.png"
          alt="Nunopi"
          className="hidden h-8 w-auto dark:block"
        />

        {/* 정중앙 — 코드/글 분석 모드 토글 */}
        {modeToggle ? (
          <div className="absolute left-1/2 -translate-x-1/2">{modeToggle}</div>
        ) : null}

        {/* 우측 — provider 설정 */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title={t("header.settings")}
          aria-label={t("header.settings")}
        >
          <IconSettings size={18} stroke={2} aria-hidden />
        </button>
      </div>
    </header>
  );
}
