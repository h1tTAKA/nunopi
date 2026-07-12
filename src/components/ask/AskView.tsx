"use client";

import { useEffect, useRef, useState } from "react";
import { IconMessage2 } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import ChatRoom from "@/components/learning/ChatRoom";
import { loadAskThread, saveAskThread } from "@/lib/askStore";
import { createChatCard } from "@/lib/chatCard";
import { removeSuggestedCard, stripCardBlock, type SuggestedCard } from "@/lib/cardSuggestion";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";

type StreamEvent =
  | { type: "progress"; line: string }
  | { type: "thinking"; line: string }
  | { type: "result"; response: { summary: string } }
  | { type: "error"; message: string };

// 맥락 없는 순수 질문임을 에이전트에 알리는 placeholder(chat 모드 code 슬롯).
const NO_CONTEXT = "(일반 질문 — 특정 코드/글 맥락 없음)";

// 에이전트 질문(Ask) 모드 — 코드/글 없이 개념·용어만 묻는 독립 챗(뼈대: 단일 스레드).
// ChatRoom·chatCard·chat API 재사용. 세션 히스토리/서브세션/분할은 후속 이슈.
export default function AskView({ active = true, providerId, providerSettings }: {
  active?: boolean;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 마운트 시 저장 스레드 로드. 언마운트 시 진행 요청 취소.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(loadAskThread());
    return () => abortRef.current?.abort();
  }, []);

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    saveAskThread([]);
    setStreaming(null);
    setLoading(false);
  }

  // 카드 제안 칩 — 질문 답에서 나온 용어를 카드로 저장(출처=질문). 저장 후 해당 블록 제거.
  function handleCardAction(messageIndex: number, action: { add?: SuggestedCard; dismiss?: boolean }) {
    if (action.add) {
      // 출처=질문(특정 카드/분석 없음) — extra 빈 객체.
      createChatCard(action.add.kind ?? "term", action.add.term, action.add.definition, t("ask.cardSource"), undefined, {});
    }
    const addedTerm = action.add?.term;
    const next = messages.map((m, i) =>
      i === messageIndex && m.role === "assistant"
        ? { ...m, content: addedTerm ? removeSuggestedCard(m.content, addedTerm) : stripCardBlock(m.content) }
        : m,
    );
    setMessages(next);
    saveAskThread(next);
  }

  function handleSend(text: string) {
    if (loading) return;
    const thread: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(thread);
    saveAskThread(thread);
    setStreaming("");
    setLoading(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    (async () => {
      let answer = "";
      try {
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            request: { code: NO_CONTEXT, locale, providerId, mode: "chat", messages: thread, providerSettings },
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          if (!ac.signal.aborted) {
            const next: ChatMessage[] = [...thread, { role: "assistant", content: t("chat.replyFailed") }];
            setMessages(next); saveAskThread(next);
          }
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
            try { ev = JSON.parse(l) as StreamEvent; } catch { continue; }
            if (ev.type === "progress" && providerId !== "codex-agent") setStreaming(ev.line);
            else if (ev.type === "result") answer = ev.response.summary;
          }
        }
        // 개행으로 끝나지 않은 마지막 이벤트(result) 유실 방지 — 남은 버퍼 flush.
        if (buffer.trim()) {
          try {
            const ev = JSON.parse(buffer) as StreamEvent;
            if (ev.type === "result") answer = ev.response.summary;
          } catch { /* 부분 청크 — 무시 */ }
        }
        if (!ac.signal.aborted) {
          const next: ChatMessage[] = [...thread, { role: "assistant", content: answer || "(빈 응답)" }];
          setMessages(next); saveAskThread(next);
        }
      } catch {
        if (!ac.signal.aborted) {
          const next: ChatMessage[] = [...thread, { role: "assistant", content: t("chat.replyError") }];
          setMessages(next); saveAskThread(next);
        }
      } finally {
        if (!ac.signal.aborted) { setStreaming(null); setLoading(false); }
      }
    })();
  }

  return (
    <div aria-hidden={!active} className="flex h-full w-full flex-col items-center overflow-hidden px-4 py-6">
      <div className="mb-4 flex shrink-0 items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        <IconMessage2 size={18} stroke={2} className="text-[#3B34E2] dark:text-[#8b86f5]" aria-hidden />
        {t("ask.title")}
      </div>
      {/* 중앙 정렬 챗(좌측 세션 패널은 이슈2에서). ChatRoom 재사용. */}
      <div className="flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#15161d]">
        <ChatRoom
          messages={messages}
          streaming={streaming}
          isLoading={loading}
          mode="code"
          onSend={handleSend}
          onClear={handleClear}
          onCardAction={handleCardAction}
        />
      </div>
    </div>
  );
}
