"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCards } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import { useFlyCard } from "@/components/memorize/FlyCard";
import { collectCards } from "@/lib/srs/collect";
import { CARDS_CHANGED_EVENT } from "@/lib/chatCard";
import type { Card } from "@/lib/srs/types";

const SOURCES = ["token", "concept", "term"] as const;
const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

// 현재 Ask 세션에서 생성된 카드 목록 패널. 클릭 시 FlyCard 연출(클릭 지점에서 날아옴).
// 카드는 sourceKind==="ask" && sourceSessionId===sessionId 로 필터(전역 카드 풀에서 파생).
export default function AskSessionCards({ sessionId, sourceLabel }: {
  sessionId: string;
  // 카드 출처 라벨을 현재 store 기준으로 재계산(rename 즉시 반영).
  sourceLabel: (sessionId?: string, subId?: string) => string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { throwCard } = useFlyCard();
  const [cards, setCards] = useState<Card[]>([]);

  const reload = useCallback(() => {
    if (!sessionId) { setCards([]); return; }
    const all = collectCards([...SOURCES], new Date());
    setCards(all.filter((c) => c.sourceKind === "ask" && c.sourceSessionId === sessionId));
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    window.addEventListener(CARDS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(CARDS_CHANGED_EVENT, reload);
  }, [reload]);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#13141b]">
      <div className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <IconCards size={15} stroke={2} aria-hidden />
        {t("ask.sessionCards")}
        {cards.length > 0 && <span className="text-zinc-400 dark:text-zinc-500">· {cards.length}</span>}
      </div>
      <div className="nunopi-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-zinc-400 dark:text-zinc-500">{t("ask.noSessionCards")}</p>
        ) : (
          cards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={(e) => {
                // 출처를 현재 이름으로 갱신해 던짐(스냅샷 아닌 실시간 브레드크럼).
                const live = sourceLabel(card.sourceSessionId, card.sourceSubId);
                throwCard(live ? { ...card, sourceTitle: live } : card, e.currentTarget.getBoundingClientRect());
              }}
              className="mb-1 flex w-full flex-col items-start gap-0.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:border-[#3B34E2] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[#8b86f5]"
            >
              <span className="w-full truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{card.front}</span>
              {card.back && <span className="line-clamp-2 text-[12px] text-zinc-500 dark:text-zinc-400">{card.back}</span>}
              {card.bookmarkedAt && (
                <span className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {new Date(card.bookmarkedAt).toLocaleString(LOCALE_TAG[locale] ?? "en-US", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
