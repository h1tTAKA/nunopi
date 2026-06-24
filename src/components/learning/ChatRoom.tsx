"use client";

import { useEffect, useRef, useState } from "react";
import { IconMessageCircle } from "@tabler/icons-react";
import type { ChatMessage } from "@/lib/agent";
import Markdown from "./Markdown";

interface ChatRoomProps {
  messages: ChatMessage[];
  // 스트리밍 중인 어시스턴트 답변(타이핑). 없으면 대기.
  streaming?: string | null;
  isLoading: boolean;
  disabled?: boolean; // 분석 전 등 비활성 사유.
  disabledHint?: string;
  onSend: (text: string) => void;
  onClear?: () => void;
}

// 학습 챗 — 코드에 대해 튜터에게 질문. 에디터 하단 분할 영역에 들어간다.
// 대화를 마크다운 문자열로(어시스턴트 답은 이미 마크다운이라 그대로 → 표/코드 보존).
function formatChatAsMarkdown(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "**🙋 나**" : "**🤖 튜터**"}\n\n${m.content}`)
    .join("\n\n---\n\n");
}

export default function ChatRoom({ messages, streaming, isLoading, disabled, disabledHint, onSend, onClear }: ChatRoomProps) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // 대화가 (다른 경로로) 비워지면 초기화 확인 상태도 해제 — 다음 대화에서 잔류 방지.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (messages.length === 0) setConfirmingClear(false);
  }, [messages.length]);

  async function handleCopy() {
    if (messages.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatChatAsMarkdown(messages));
      setCopied(true);
    } catch { /* ignore — clipboard may be unavailable */ }
  }

  // 새 메시지/스트리밍마다 맨 아래로.
  const tick = `${messages.length}:${streaming?.length ?? 0}`;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tick]);

  function submit() {
    const text = input.trim();
    if (!text || isLoading || disabled) return;
    setInput("");
    onSend(text);
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300"><IconMessageCircle size={15} stroke={2} aria-hidden /> 학습 챗</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">궁금한 걸 물어보세요</span>
        {messages.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => { void handleCopy(); }}
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="대화 전체를 마크다운으로 복사"
            >
              {copied ? "복사됨 ✓" : "MD 복사"}
            </button>
            {confirmingClear ? (
              <>
                <button
                  type="button"
                  onClick={() => { setConfirmingClear(false); onClear?.(); }}
                  className="rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-600"
                >
                  정말 초기화?
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                disabled={isLoading}
                className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                title="대화 초기화"
              >
                초기화
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="nunopi-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && !streaming && (
          <p className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            {disabled ? (disabledHint ?? "먼저 입력을 채워 보세요.") : "예) 이게 무슨 뜻이에요? 왜 이렇게 하나요?"}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            {m.role === "user" ? (
              <div className="max-w-[85%] select-text whitespace-pre-wrap rounded-2xl bg-blue-500 px-3 py-2 text-xs text-white">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[85%] select-text rounded-2xl bg-white px-3 py-2 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <Markdown>{m.content}</Markdown>
              </div>
            )}
          </div>
        ))}
        {streaming != null && (
          <div className="flex justify-start">
            <div className="max-w-[85%] select-text rounded-2xl bg-white px-3 py-2 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {streaming ? <Markdown>{streaming}</Markdown> : <span className="text-xs">답변 작성 중…</span>}
            </div>
          </div>
        )}
        {isLoading && streaming == null && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">답변 작성 중…</p>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-zinc-200 p-2 dark:border-zinc-800">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={isLoading || disabled}
          rows={1}
          placeholder={disabled ? (disabledHint ?? "입력 후 질문 가능") : "질문 입력 (Enter 전송, Shift+Enter 줄바꿈)"}
          className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isLoading || disabled || !input.trim()}
          className="shrink-0 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900"
        >
          전송
        </button>
      </div>
    </div>
  );
}
