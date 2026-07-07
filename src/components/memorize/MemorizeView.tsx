"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import DeckSelect from "./DeckSelect";
import type { Deck, SrsSource } from "@/lib/srs/types";

type MemPhase = "select" | "session";

// 암기 모드 최상위 뷰. ③ 덱 선택 → ④ 카드 세션(현재 placeholder).
export default function MemorizeView() {
  const t = useT();
  const [phase, setPhase] = useState<MemPhase>("select");
  const [, setSession] = useState<{ deck: Deck; sources: SrsSource[] } | null>(null);

  function handleStart(deck: Deck, sources: SrsSource[]) {
    setSession({ deck, sources });
    setPhase("session");
  }

  if (phase === "session") {
    // ④에서 CardSession으로 교체.
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">{t("mem.comingSoon")}</p>
        <button
          type="button"
          onClick={() => setPhase("select")}
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {t("mem.backToDecks")}
        </button>
      </div>
    );
  }

  return <DeckSelect onStart={handleStart} />;
}
