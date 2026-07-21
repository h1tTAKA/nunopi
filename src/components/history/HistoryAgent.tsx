"use client";

import { useRef, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import ChatRoom from "@/components/learning/ChatRoom";
import { collectHistory } from "@/lib/history/collect";
import { buildHistoryContext } from "@/lib/history/context";
import { dayKey } from "@/lib/srs/activityLog";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";

interface HistoryAgentProps {
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
}

type StreamEvent =
  | { type: "progress"; line: string }
  | { type: "thinking"; line: string }
  | { type: "result"; response: { summary: string } }
  | { type: "error"; message: string };

// 홈 우측 에이전트 — 유저의 전 학습 이력을 컨텍스트로 참조해 답한다("어제 뭐 배웠지?").
// ChatRoom UI 재사용, mode:"chat" 스트림 호출(MemorizeChat 패턴). 단일 in-memory 스레드(미저장).
// 컨텍스트는 전송 시점에 최신 collectHistory()로 빌드(항상 최신, 리스너 불필요).
export default function HistoryAgent({ providerId, providerSettings }: HistoryAgentProps) {
  const t = useT();
  const { locale } = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(null);
    setLoading(false);
  }

  function handleSend(text: string) {
    if (loading) return;
    const thread: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(thread);
    setStreaming("");
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;
    (async () => {
      let answer = "";
      try {
        // 전송 시점 최신 이력 → 날짜 다이제스트 컨텍스트.
        const events = await collectHistory();
        const context = buildHistoryContext(events, dayKey(new Date()));
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            request: { code: context, locale, providerId, mode: "chat", messages: thread, providerSettings },
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          if (!ac.signal.aborted) setMessages([...thread, { role: "assistant", content: t("chat.replyFailed") }]);
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
            if (ev.type === "progress" && providerId !== "codex-agent") setStreaming(ev.line);
            else if (ev.type === "result") answer = ev.response.summary;
          }
        }
        if (!ac.signal.aborted) setMessages([...thread, { role: "assistant", content: answer || "(빈 응답)" }]);
      } catch {
        if (!ac.signal.aborted) setMessages([...thread, { role: "assistant", content: t("chat.replyError") }]);
      } finally {
        if (!ac.signal.aborted) {
          setStreaming(null);
          setLoading(false);
        }
      }
    })();
  }

  return (
    <ChatRoom
      messages={messages}
      streaming={streaming}
      isLoading={loading}
      onSend={handleSend}
      onClear={handleClear}
    />
  );
}
