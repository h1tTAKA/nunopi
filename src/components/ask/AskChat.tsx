"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowUp, IconPlus, IconX, IconTrash, IconSparkles } from "@tabler/icons-react";
import Markdown from "@/components/learning/Markdown";
import { useT } from "@/lib/i18n/I18nProvider";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { parseCardSuggestions, stripStreamingCardBlock, type SuggestedCard } from "@/lib/cardSuggestion";
import { bookmarkedTermExists } from "@/lib/bookmarkDetails";
import type { ChatMessage } from "@/lib/agent";

interface AskChatProps {
  title: string; // 활성 세션 제목 — 좌상단 헤더.
  messages: ChatMessage[];
  streaming?: string | null;
  isLoading: boolean;
  onSend: (text: string) => void;
  onClear?: () => void;
  onCardAction?: (messageIndex: number, action: { add?: SuggestedCard; dismiss?: boolean }) => void;
  // 서브세션(한 세션 내 대화 스레드) 탭.
  subIds: string[];
  activeSubId: string | null;
  onSwitchSub: (id: string) => void;
  onNewSub: () => void;
  onDeleteSub: (id: string) => void;
}

// Ask 모드 전용 챗 — 질문이 메인인 모드라 ChatGPT식 중앙 정렬·프레임리스 레이아웃.
// 답변은 버블 없이 폭 전체, 유저 말풍선만 우측. 로직(Markdown·카드칩·스트리밍)은 공용 재사용.
export default function AskChat({
  title, messages, streaming, isLoading, onSend, onClear, onCardAction,
  subIds, activeSubId, onSwitchSub, onNewSub, onDeleteSub,
}: AskChatProps) {
  const t = useT();
  const confirm = useConfirm();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0 && streaming == null;

  // 새 메시지/스트리밍마다 맨 아래로.
  const tick = `${messages.length}:${streaming?.length ?? 0}`;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tick]);

  function submit() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    onSend(text);
  }

  async function confirmDeleteSub(id: string) {
    if (await confirm({ title: t("confirm.deleteSessionTitle"), message: t("confirm.deleteSession"), confirmText: t("common.delete"), danger: true })) {
      onDeleteSub(id);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 헤더 — 세션 제목 + 서브세션 탭(제목 밑 좌상단). */}
      <div className="shrink-0 border-b border-zinc-100 px-5 pb-2 pt-3 dark:border-zinc-800/60">
        <div className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</div>
        <div className="no-scrollbar mt-2 flex items-center gap-1 overflow-x-auto">
          {subIds.map((id, i) => {
            const isActive = id === activeSubId;
            return (
              <span
                key={id}
                className={`group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? "bg-[#3B34E2] text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <button type="button" onClick={() => onSwitchSub(id)} className="whitespace-nowrap">
                  {t("ask.thread", { n: i + 1 })}
                </button>
                {subIds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { void confirmDeleteSub(id); }}
                    aria-label={t("ask.deleteSession")}
                    className={`rounded transition hover:text-red-300 ${isActive ? "inline-flex text-white/70" : "hidden text-zinc-400 group-hover:inline-flex"}`}
                  >
                    <IconX size={12} stroke={2.5} aria-hidden />
                  </button>
                )}
              </span>
            );
          })}
          <button
            type="button"
            onClick={onNewSub}
            disabled={isLoading}
            title={t("ask.newThread")}
            aria-label={t("ask.newThread")}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <IconPlus size={13} stroke={2.5} aria-hidden />
            {t("ask.newThread")}
          </button>
          {messages.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={isLoading}
              title={t("ask.clearThread")}
              aria-label={t("ask.clearThread")}
              className="ml-auto inline-flex shrink-0 items-center rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800"
            >
              <IconTrash size={15} stroke={2} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div ref={scrollRef} className="nunopi-scroll min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <IconSparkles size={34} stroke={1.5} className="text-[#3B34E2] dark:text-[#8b86f5]" aria-hidden />
            <p className="text-xl font-semibold text-zinc-700 dark:text-zinc-200">{t("ask.empty")}</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">{t("chat.exampleHint")}</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] select-text whitespace-pre-wrap rounded-3xl bg-zinc-100 px-4 py-2.5 text-[15px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                      {m.content}
                    </div>
                  </div>
                );
              }
              // 어시스턴트 — 버블 없이 폭 전체. nunopi-cards 블록은 칩으로.
              const { text, cards } = parseCardSuggestions(m.content);
              const freshCards = cards.filter((c) => !bookmarkedTermExists(c.term));
              return (
                <div key={i} className="flex flex-col items-start gap-2">
                  <div className="w-full select-text text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-100">
                    <Markdown>{text}</Markdown>
                  </div>
                  {onCardAction && freshCards.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {freshCards.map((c) => (
                        <button
                          key={c.term}
                          type="button"
                          onClick={() => onCardAction(i, { add: c })}
                          className="inline-flex items-center gap-1 rounded-full bg-[#3B34E2] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-[#322bc9]"
                        >
                          <IconPlus size={12} stroke={2.5} aria-hidden />
                          {c.term} {t("chat.saveAsCard")}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onCardAction(i, { dismiss: true })}
                        className="rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                      >
                        {t("chat.noThanks")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {streaming != null && (
              <div className="w-full select-text text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-100">
                {streaming ? <Markdown>{stripStreamingCardBlock(streaming)}</Markdown> : <span className="text-zinc-400 dark:text-zinc-500">{t("chat.replying")}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 입력창 — 하단 중앙 pill. */}
      <div className="shrink-0 pb-4 pt-1">
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-4 pr-1.5 shadow-sm transition focus-within:border-[#3B34E2] dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-[#8b86f5]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={isLoading}
              rows={1}
              placeholder={t("ask.placeholder")}
              className="max-h-32 min-h-[1.5rem] flex-1 resize-none bg-transparent py-1 text-[15px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={submit}
              disabled={isLoading || !input.trim()}
              aria-label={t("chat.send")}
              className="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full bg-[#3B34E2] text-white transition hover:bg-[#322bc9] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <IconArrowUp size={18} stroke={2.5} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
