"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import Markdown from "@/components/learning/Markdown";
import type { AgentProviderKind } from "@/lib/agent";
import type { Card } from "@/lib/srs/types";
import { loadCardExplain, saveCardExplain, clearCardExplain, streamCardExplain } from "@/lib/cardExplain";

interface CardExplainPanelProps {
  card: Card;
  providerId: AgentProviderKind;
  flipped: boolean; // 카드를 뒤집었을 때만 설명 생성.
}

// 왼쪽 반투명 패널 — 현재 카드(용어)의 디폴트(맥락 독립) 설명을 에이전트가 실시간 타이핑.
// 카드별 캐시(재방문 즉시), 리셋 재생성. 뒤 부채꼴이 비치도록 반투명.
export default function CardExplainPanel({ card, providerId, flipped }: CardExplainPanelProps) {
  const t = useT();
  const { locale } = useLocale();
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setText("");
    setError(false);
    setStreaming(true);
    streamCardExplain(
      { term: card.front, kind: card.source, providerId, locale },
      (full) => setText(full),
      ac.signal,
    )
      .then((md) => {
        if (ac.signal.aborted) return;
        saveCardExplain(card.key, md);
        setStreaming(false);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setError(true);
        setStreaming(false);
      });
  }, [card.front, card.source, card.key, providerId, locale]);

  // 카드를 뒤집었을 때만 생성/표시. 안 뒤집었으면 비우고 안내만.
  useEffect(() => {
    if (!flipped) {
      abortRef.current?.abort();
      /* eslint-disable react-hooks/set-state-in-effect */
      setText("");
      setStreaming(false);
      setError(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const cached = loadCardExplain(card.key);
    if (cached) {
      abortRef.current?.abort();
      /* eslint-disable react-hooks/set-state-in-effect */
      setText(cached);
      setStreaming(false);
      setError(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    generate();
    return () => abortRef.current?.abort();
  }, [card.key, flipped, generate]);

  function handleReset() {
    clearCardExplain(card.key);
    generate();
  }

  return (
    <div className="flex w-64 flex-col gap-2 rounded-xl border border-zinc-200/40 bg-white/10 p-3 text-xs backdrop-blur-sm dark:border-zinc-700/40 dark:bg-zinc-900/20">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {t("mem.explainTitle")}
        </span>
        <button
          type="button"
          onClick={handleReset}
          disabled={streaming}
          aria-label={t("mem.explainReset")}
          title={t("mem.explainReset")}
          className="rounded p-0.5 text-zinc-400 transition hover:text-blue-500 disabled:opacity-40 dark:text-zinc-500 dark:hover:text-blue-400"
        >
          <IconRefresh size={13} stroke={2} className={streaming ? "animate-spin" : ""} aria-hidden />
        </button>
      </div>
      <div className="nunopi-scroll max-h-[60vh] overflow-y-auto pr-1 text-zinc-600 dark:text-zinc-300">
        {!flipped ? (
          <span className="text-zinc-400 dark:text-zinc-500">{t("mem.explainFlipHint")}</span>
        ) : error ? (
          <span className="text-rose-500 dark:text-rose-400">{t("mem.explainError")}</span>
        ) : text ? (
          <Markdown>{text}</Markdown>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">{t("mem.explainLoading")}</span>
        )}
      </div>
    </div>
  );
}
