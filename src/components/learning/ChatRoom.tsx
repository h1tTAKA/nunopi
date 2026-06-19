"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/agent";

interface ChatRoomProps {
  messages: ChatMessage[];
  // 스트리밍 중인 어시스턴트 답변(타이핑). 없으면 대기.
  streaming?: string | null;
  isLoading: boolean;
  disabled?: boolean; // 분석 전 등 비활성 사유.
  disabledHint?: string;
  onSend: (text: string) => void;
}

// 학습 챗 — 코드에 대해 튜터에게 질문. 에디터 하단 분할 영역에 들어간다.
export default function ChatRoom({ messages, streaming, isLoading, disabled, disabledHint, onSend }: ChatRoomProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">💬 학습 챗</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">코드에 대해 물어보세요</span>
      </div>

      <div ref={scrollRef} className="nunopi-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && !streaming && (
          <p className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            {disabled ? (disabledHint ?? "먼저 코드를 분석해 보세요.") : "예) 이 코드에서 useState는 왜 쓰나요?"}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] select-text whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs ${
                m.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {streaming != null && (
          <div className="flex justify-start">
            <div className="max-w-[85%] select-text whitespace-pre-wrap rounded-2xl bg-white px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {streaming || "답변 작성 중…"}
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
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={isLoading || disabled}
          rows={1}
          placeholder={disabled ? (disabledHint ?? "분석 후 질문 가능") : "질문 입력 (Enter 전송, Shift+Enter 줄바꿈)"}
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
