"use client";

import { useEffect, useRef, useState } from "react";
import { IconMessageCircle, IconX } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import ChatRoom from "@/components/learning/ChatRoom";
import { loadCardExplain } from "@/lib/cardExplain";
import { loadCardChat, saveCardChat } from "@/lib/cardChat";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";
import type { Card } from "@/lib/srs/types";

interface MemorizeChatProps {
  card: Card;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
}

type StreamEvent =
  | { type: "progress"; line: string }
  | { type: "result"; response: { summary: string } }
  | { type: "error"; message: string };

// 암기 카드 우하단 챗 — 현재 카드(용어) 스코프 로컬 단일 스레드(히스토리 미저장).
// 코드/글 모드 챗은 좌하단, 암기는 우하단(대칭). ChatRoom UI 재사용.
export default function MemorizeChat({ card, providerId, providerSettings }: MemorizeChatProps) {
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 카드가 바뀌면 그 카드의 저장된 스레드 로드(카드별 고유 세션) + 진행 중 요청 취소.
  // 언마운트(탭 이탈/세션 종료) 시에도 abort(요청 누수 방지).
  useEffect(() => {
    abortRef.current?.abort();
    /* eslint-disable react-hooks/set-state-in-effect */
    setMessages(loadCardChat(card.key));
    setStreaming(null);
    setLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => abortRef.current?.abort();
  }, [card.key]);

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    saveCardChat(card.key, []);
    setStreaming(null);
    setLoading(false);
  }

  function handleSend(text: string) {
    if (loading) return;
    const thread: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(thread);
    saveCardChat(card.key, thread);
    setStreaming("");
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;
    // 맥락 — 용어 + 추가설명(있으면)으로 이 카드 기준 답변 유도.
    const explain = loadCardExplain(card.key) ?? "";
    const context = `용어: ${card.front}\n\n${card.back}${explain ? `\n\n추가설명:\n${explain}` : ""}`;
    (async () => {
      let answer = "";
      try {
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            request: {
              code: context,
              locale,
              providerId,
              mode: "chat",
              messages: thread,
              providerSettings,
            },
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const next: ChatMessage[] = [...thread, { role: "assistant", content: t("chat.replyFailed") }];
          setMessages(next);
          saveCardChat(card.key, next);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.trim()) continue;
            let ev: StreamEvent;
            try {
              ev = JSON.parse(l) as StreamEvent;
            } catch {
              continue;
            }
            // codex는 진행 라벨만 흘리므로 타이핑에 안 씀.
            if (ev.type === "progress" && providerId !== "codex-agent") setStreaming(ev.line);
            else if (ev.type === "result") answer = ev.response.summary;
          }
        }
        const next: ChatMessage[] = [...thread, { role: "assistant", content: answer || "(빈 응답)" }];
        setMessages(next);
        saveCardChat(card.key, next);
      } catch {
        if (!ac.signal.aborted) {
          const next: ChatMessage[] = [...thread, { role: "assistant", content: t("chat.replyError") }];
          setMessages(next);
          saveCardChat(card.key, next);
        }
      } finally {
        if (!ac.signal.aborted) {
          setStreaming(null);
          setLoading(false);
        }
      }
    })();
  }

  return (
    <>
      {/* 우하단 토글 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("input.ask")}
        title={t("input.ask")}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-lime-600 text-white shadow-lg transition hover:bg-lime-700"
      >
        {open ? <IconX size={20} stroke={2} aria-hidden /> : <IconMessageCircle size={20} stroke={2} aria-hidden />}
      </button>

      {/* 우하단 챗 패널 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-30 flex h-[61vh] w-[30rem] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#15161d]">
          <ChatRoom
            messages={messages}
            streaming={streaming}
            isLoading={loading}
            mode="code"
            onSend={handleSend}
            onClear={handleClear}
          />
        </div>
      )}
    </>
  );
}
