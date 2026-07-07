"use client";

import { useMemo, useState } from "react";
import { IconCode, IconFileText, IconStack2, IconCheck } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { deckStats } from "@/lib/srs/due";
import { DECK_SOURCES, type Deck, type SrsSource } from "@/lib/srs/types";

interface DeckSelectProps {
  // 선택한 덱 + 세부 출처로 세션 시작.
  onStart: (deck: Deck, sources: SrsSource[]) => void;
}

const DECK_META: { deck: Deck; tKey: string; Icon: typeof IconCode }[] = [
  { deck: "code", tKey: "mem.deckCode", Icon: IconCode },
  { deck: "text", tKey: "mem.deckText", Icon: IconFileText },
  { deck: "all", tKey: "mem.deckAll", Icon: IconStack2 },
];

// 덱 선택 화면 — 덱 3장(오늘 due/전체 배지) + 코드덱 세부 토글 + 시작.
export default function DeckSelect({ onStart }: DeckSelectProps) {
  const t = useT();
  const [selected, setSelected] = useState<Deck>("code");
  // 코드덱 세부 출처 토글(토큰/개념). 글덱은 term 통째(관련개념/IT용어 미분리).
  const [codeSources, setCodeSources] = useState<Set<SrsSource>>(new Set(["token", "concept"]));

  // 선택 덱의 유효 출처 — 코드덱은 토글 반영, 그 외는 덱 전체 출처.
  const effectiveSources = (deck: Deck): SrsSource[] =>
    deck === "code" ? [...codeSources] : DECK_SOURCES[deck];

  // 각 덱 통계 — now는 마운트 시 1회 고정(진입 시점 기준).
  const now = useMemo(() => new Date(), []);
  const stats = useMemo(
    () => ({
      code: deckStats("code", now, [...codeSources]),
      text: deckStats("text", now),
      all: deckStats("all", now),
    }),
    [now, codeSources],
  );

  function toggleSource(s: SrsSource) {
    setCodeSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const selectedStats = stats[selected];
  const canStart = selectedStats.due > 0;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
      <h2 className="text-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {t("mem.selectDeck")}
      </h2>

      <div className="flex flex-col gap-3">
        {DECK_META.map(({ deck, tKey, Icon }) => {
          const s = stats[deck];
          const active = selected === deck;
          return (
            <button
              key={deck}
              type="button"
              onClick={() => setSelected(deck)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-blue-400 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/20"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <Icon size={22} stroke={2} className="shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
              <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">{t(tKey)}</span>
              {s.total === 0 ? (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.emptyBookmarks")}</span>
              ) : (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-blue-500 dark:text-blue-400">{t("mem.today")} {s.due}</span>
                  {" · "}
                  {t("mem.total")} {s.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 코드덱 세부 출처 토글 */}
      {selected === "code" && (
        <div className="flex items-center justify-center gap-2">
          {(["token", "concept"] as SrsSource[]).map((s) => {
            const on = codeSources.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSource(s)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {on && <IconCheck size={13} stroke={2.5} aria-hidden />}
                {t(s === "token" ? "mem.srcToken" : "mem.srcConcept")}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        disabled={!canStart}
        onClick={() => onStart(selected, effectiveSources(selected))}
        className="mt-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selectedStats.total > 0 && selectedStats.due === 0 ? t("mem.noDueToday") : t("mem.start")}
      </button>
    </div>
  );
}
