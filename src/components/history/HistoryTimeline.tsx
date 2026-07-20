"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCode, IconMessage2, IconListCheck, IconCards, IconBrain, IconLoader2, type IconProps } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import { collectHistory } from "@/lib/history/collect";
import { dayKey } from "@/lib/srs/activityLog";
import { CARDS_CHANGED_EVENT } from "@/lib/chatCard";
import { CARD_CHAT_CHANGED_EVENT } from "@/lib/cardChat";
import type { HistoryEventType, UnifiedHistoryEvent } from "@/lib/history/types";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

// 타입별 아이콘·색(브랜드 계열 + 구분).
const TYPE_META: Record<HistoryEventType, { Icon: React.ComponentType<IconProps>; cls: string }> = {
  analysis: { Icon: IconCode, cls: "text-[#3B34E2] dark:text-[#8b86f5]" },
  chat: { Icon: IconMessage2, cls: "text-sky-500" },
  ask: { Icon: IconMessage2, cls: "text-indigo-500" },
  quiz: { Icon: IconListCheck, cls: "text-violet-500" },
  bookmark: { Icon: IconCards, cls: "text-lime-500" },
  review: { Icon: IconBrain, cls: "text-amber-500" },
};

// 전역 히스토리 좌 타임라인 — 모든 저장소 수집(collectHistory) → 날짜별 그룹 렌더.
// 클릭 이동은 자식 #4에서. 지금은 표시 + 활동 변경 시 재수집.
export default function HistoryTimeline() {
  const t = useT();
  const { locale } = useLocale();
  const tag = LOCALE_TAG[locale] ?? "en-US";
  const [events, setEvents] = useState<UnifiedHistoryEvent[] | null>(null);

  const reload = useCallback(() => {
    void collectHistory().then(setEvents);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(CARDS_CHANGED_EVENT, reload);
    window.addEventListener(CARD_CHAT_CHANGED_EVENT, reload);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener(CARDS_CHANGED_EVENT, reload);
      window.removeEventListener(CARD_CHAT_CHANGED_EVENT, reload);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);

  if (events === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-zinc-400 dark:text-zinc-500">
        <IconLoader2 size={20} stroke={2} className="animate-spin" aria-hidden />
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <p className="text-[13px] text-zinc-400 dark:text-zinc-500">{t("home.empty")}</p>
      </div>
    );
  }

  // 날짜별 그룹(이미 desc 정렬이라 최초 등장 순 = 최신 날짜부터).
  const groups: { day: string; items: UnifiedHistoryEvent[] }[] = [];
  for (const e of events) {
    const d = new Date(e.createdAt);
    const k = Number.isNaN(d.getTime()) ? "?" : dayKey(d);
    const last = groups[groups.length - 1];
    if (last && last.day === k) last.items.push(e);
    else groups.push({ day: k, items: [e] });
  }

  const dayLabel = (k: string) => {
    if (k === "?") return "?";
    const d = new Date(k + "T00:00:00");
    return d.toLocaleDateString(tag, { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  };
  const timeLabel = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="nunopi-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {groups.map((g) => (
        <div key={g.day} className="mb-3">
          <div className="sticky top-0 z-10 bg-zinc-50/95 py-1.5 text-[11px] font-semibold text-zinc-500 backdrop-blur dark:bg-[#13141b]/95 dark:text-zinc-400">
            {dayLabel(g.day)}
          </div>
          <div className="flex flex-col gap-1">
            {g.items.map((e) => {
              const { Icon, cls } = TYPE_META[e.type];
              return (
                <div key={e.id} className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <Icon size={15} stroke={2} className={`mt-0.5 shrink-0 ${cls}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`shrink-0 text-[10px] font-semibold uppercase ${cls}`}>{t(`home.evt.${e.type}`)}</span>
                      {e.type !== "review" && <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">{timeLabel(e.createdAt)}</span>}
                    </div>
                    <p className="truncate text-[13px] text-zinc-700 dark:text-zinc-200">{e.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
