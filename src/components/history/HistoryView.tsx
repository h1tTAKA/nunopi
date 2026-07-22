"use client";

import { IconHistory } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import HistoryTimeline from "@/components/history/HistoryTimeline";
import HistoryAgent from "@/components/history/HistoryAgent";
import type { HistoryNav } from "@/lib/history/types";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";

// 전역 학습 히스토리(홈) 뷰 — 좌: 전 기능 이력 타임라인 / 우: 이력 참조 에이전트.
// 두 패널을 rounded-2xl 카드로 프레임(암기 홈 디자인 언어 차용).
const CARD = "flex min-h-0 w-1/2 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30";
const HEADER = "flex items-center gap-2 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70";
const ICON = "text-[#3B34E2] dark:text-[#8b86f5]";
const TITLE = "text-sm font-semibold text-zinc-700 dark:text-zinc-200";

export default function HistoryView({ active = true, onNavigate, providerId, providerSettings }: { active?: boolean; onNavigate?: (nav: HistoryNav) => void; providerId: AgentProviderKind; providerSettings: ProviderSettings }) {
  const t = useT();
  return (
    <div aria-hidden={!active} className="flex h-full w-full min-h-0 gap-4 p-5">
      {/* 좌: 히스토리 타임라인 */}
      <section className={CARD}>
        <header className={HEADER}>
          <IconHistory size={16} stroke={2} className={ICON} aria-hidden />
          <span className={TITLE}>{t("home.title")}</span>
        </header>
        <HistoryTimeline onNavigate={onNavigate} />
      </section>

      {/* 우: 이력 참조 에이전트 */}
      <section className={CARD}>
        <header className={HEADER}>
          {/* 누노피 심볼(좌상단 브랜드와 동일) — 라이트=darkeye, 다크=컬러 눈알 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nunopi-symbol-darkeye-transparent.png" alt="" aria-hidden className="block h-7 w-7 object-contain dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nunopi-symbol-transparent.png" alt="" aria-hidden className="hidden h-7 w-7 object-contain dark:block" />
          <span className={TITLE}>{t("home.agent")}</span>
        </header>
        <div className="min-h-0 flex-1 p-3">
          <HistoryAgent providerId={providerId} providerSettings={providerSettings} />
        </div>
      </section>
    </div>
  );
}
