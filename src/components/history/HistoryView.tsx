"use client";

import { IconHistory, IconSparkles } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import HistoryTimeline from "@/components/history/HistoryTimeline";

// 전역 학습 히스토리(홈) 뷰 — 좌: 전 기능 이력 타임라인 / 우: 이력 참조 에이전트.
// 이번 이슈(#561)는 2분할 뼈대 + 빈 상태. 타임라인 수집(#3)·클릭이동(#4)·에이전트(#5)는 후속.
export default function HistoryView({ active = true }: { active?: boolean }) {
  const t = useT();
  return (
    <div aria-hidden={!active} className="flex h-full w-full min-h-0">
      {/* 좌: 히스토리 타임라인(자리) */}
      <section className="flex min-h-0 w-1/2 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <IconHistory size={15} stroke={2} aria-hidden />
          <span>{t("home.title")}</span>
        </div>
        <HistoryTimeline />
      </section>

      {/* 우: 이력 참조 에이전트(자리) */}
      <section className="flex min-h-0 w-1/2 flex-col">
        <div className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <IconSparkles size={15} stroke={2} aria-hidden />
          <span>{t("home.agent")}</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500">{t("home.agentSoon")}</p>
        </div>
      </section>
    </div>
  );
}
