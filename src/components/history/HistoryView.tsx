"use client";

import { IconHistory, IconSparkles } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import HistoryTimeline from "@/components/history/HistoryTimeline";
import HistoryAgent from "@/components/history/HistoryAgent";
import type { HistoryNav } from "@/lib/history/types";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";

// 전역 학습 히스토리(홈) 뷰 — 좌: 전 기능 이력 타임라인 / 우: 이력 참조 에이전트.
export default function HistoryView({ active = true, onNavigate, providerId, providerSettings }: { active?: boolean; onNavigate?: (nav: HistoryNav) => void; providerId: AgentProviderKind; providerSettings: ProviderSettings }) {
  const t = useT();
  return (
    <div aria-hidden={!active} className="flex h-full w-full min-h-0">
      {/* 좌: 히스토리 타임라인(자리) */}
      <section className="flex min-h-0 w-1/2 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <IconHistory size={15} stroke={2} aria-hidden />
          <span>{t("home.title")}</span>
        </div>
        <HistoryTimeline onNavigate={onNavigate} />
      </section>

      {/* 우: 이력 참조 에이전트 */}
      <section className="flex min-h-0 w-1/2 flex-col">
        <div className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <IconSparkles size={15} stroke={2} aria-hidden />
          <span>{t("home.agent")}</span>
        </div>
        <div className="min-h-0 flex-1 px-3 pb-3">
          <HistoryAgent providerId={providerId} providerSettings={providerSettings} />
        </div>
      </section>
    </div>
  );
}
