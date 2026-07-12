"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowUp, IconPlus, IconTrash, IconSparkles, IconLayoutColumns, IconX } from "@tabler/icons-react";
import Markdown from "@/components/learning/Markdown";
import { useT } from "@/lib/i18n/I18nProvider";
import { parseCardSuggestions, stripStreamingCardBlock, type SuggestedCard } from "@/lib/cardSuggestion";
import { bookmarkedTermExists } from "@/lib/bookmarkDetails";
import type { ChatMessage } from "@/lib/agent";

interface AskChatProps {
  title: string; // 활성 세션 제목(포괄적) — 좌상단 헤더.
  subLabel?: string; // 활성 질문(서브세션) 라벨 — "세션 / 질문 N" 브레드크럼.
  messages: ChatMessage[];
  streaming?: string | null;
  isLoading: boolean;
  onSend: (text: string) => void;
  onClear?: () => void;
  onCardAction?: (messageIndex: number, action: { add?: SuggestedCard; dismiss?: boolean }) => void;
  // 분할 타일 모드(이슈4) — 여러 질문을 나란히 표시.
  tiled?: boolean; // 타일 테두리 표시.
  focused?: boolean; // 포커스 타일 강조.
  onFocus?: () => void; // 타일 클릭/포커스 시 활성 전환.
  onClose?: () => void; // 타일 닫기(×) — 있으면 버튼 노출.
  onSplit?: () => void; // 분할(Cmd+D) — 있으면 버튼 노출.
}

// Ask 모드 전용 챗 — 질문이 메인인 모드라 ChatGPT식 중앙 정렬·프레임리스 레이아웃.
// 답변은 버블 없이 폭 전체, 유저 말풍선만 우측. 로직(Markdown·카드칩·스트리밍)은 공용 재사용.
export default function AskChat({
  title, subLabel, messages, streaming, isLoading, onSend, onClear, onCardAction,
  tiled = false, focused = false, onFocus, onClose, onSplit,
}: AskChatProps) {
  const t = useT();
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

  return (
    <div
      onFocusCapture={onFocus}
      onMouseDown={onFocus}
      className={`flex h-full flex-col overflow-hidden ${
        tiled ? `rounded-xl border ${focused ? "border-[#3B34E2] dark:border-[#8b86f5]" : "border-zinc-200 dark:border-zinc-800"}` : ""
      }`}
    >
      {/* 헤더 — 세션 제목(좌) + 분할/지우기/닫기(우). 경계선 없음. */}
      <div className="flex shrink-0 items-center gap-1.5 px-5 py-3">
        <span className="shrink-0 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</span>
        {subLabel && (
          <>
            <span className="shrink-0 text-zinc-300 dark:text-zinc-600">/</span>
            <span className="truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{subLabel}</span>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {onSplit && (
            <button
              type="button"
              onClick={onSplit}
              title={`${t("ask.split")} (⌘D)`}
              aria-label={t("ask.split")}
              className="inline-flex items-center rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <IconLayoutColumns size={15} stroke={2} aria-hidden />
            </button>
          )}
          {messages.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={isLoading}
              title={t("ask.clearThread")}
              aria-label={t("ask.clearThread")}
              className="inline-flex items-center rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800"
            >
              <IconTrash size={15} stroke={2} aria-hidden />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={t("ask.closeTile")}
              aria-label={t("ask.closeTile")}
              className="inline-flex items-center rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <IconX size={15} stroke={2} aria-hidden />
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
