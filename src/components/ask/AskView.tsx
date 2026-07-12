"use client";

import { useEffect, useRef, useState } from "react";
import { IconMessage2, IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import ChatRoom from "@/components/learning/ChatRoom";
import {
  loadAskStore,
  saveAskStore,
  createSession,
  type AskStore,
  type AskSession,
} from "@/lib/askStore";
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

const EMPTY_STORE: AskStore = { sessions: [], activeSessionId: "" };

// 에이전트 질문(Ask) 모드 — 좌측 세션 히스토리 + 활성 세션 챗(이슈2).
// 서브세션 탭/분할은 후속 이슈. 지금은 세션당 단일 챗(subs[0]).
export default function AskView({ active = true, providerId, providerSettings }: {
  active?: boolean;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [store, setStore] = useState<AskStore>(EMPTY_STORE);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // storeRef — async 완료 시 stale 클로저 없이 최신 store를 읽고 커밋하기 위함.
  const storeRef = useRef<AskStore>(EMPTY_STORE);
  const abortRef = useRef<AbortController | null>(null);

  // 마운트 시 세션 로드(항상 활성 세션 1개 보장). 언마운트 시 진행 요청 취소.
  useEffect(() => {
    const loaded = loadAskStore(t("ask.untitled"));
    storeRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(loaded);
    return () => abortRef.current?.abort();
    // t는 로케일 변경 시 바뀌지만 초기 제목에만 쓰여 재로드 불필요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 최신 store를 ref+state+localStorage에 한 번에 반영.
  function commit(next: AskStore) {
    storeRef.current = next;
    setStore(next);
    saveAskStore(next);
  }

  const activeSession = store.sessions.find((s) => s.id === store.activeSessionId) ?? store.sessions[0] ?? null;
  const activeSub = activeSession
    ? activeSession.subs.find((sub) => sub.id === activeSession.activeSubId) ?? activeSession.subs[0]
    : null;
  const messages: ChatMessage[] = activeSub?.messages ?? [];

  // 특정 세션·서브의 messages를 mapper로 갱신하고 커밋(async 완료 대비 id로 지목).
  function updateSubMessages(sessionId: string, subId: string, mapper: (msgs: ChatMessage[]) => ChatMessage[]) {
    const prev = storeRef.current;
    const next: AskStore = {
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id !== sessionId
          ? s
          : { ...s, subs: s.subs.map((sub) => (sub.id !== subId ? sub : { ...sub, messages: mapper(sub.messages) })) },
      ),
    };
    commit(next);
  }

  function resetStream() {
    abortRef.current?.abort();
    setStreaming(null);
    setLoading(false);
  }

  // ── 세션 조작 ──────────────────────────────────────────
  function handleNewSession() {
    resetStream();
    const session = createSession(t("ask.untitled"));
    commit({ sessions: [...store.sessions, session], activeSessionId: session.id });
  }

  function handleSelectSession(id: string) {
    if (id === store.activeSessionId) return;
    resetStream();
    commit({ ...store, activeSessionId: id });
  }

  function handleDeleteSession(id: string) {
    resetStream();
    const remaining = store.sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const fresh = createSession(t("ask.untitled"));
      commit({ sessions: [fresh], activeSessionId: fresh.id });
      return;
    }
    const activeSessionId = store.activeSessionId === id ? remaining[remaining.length - 1].id : store.activeSessionId;
    commit({ sessions: remaining, activeSessionId });
  }

  function commitRename(id: string) {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (title) {
      commit({ ...store, sessions: store.sessions.map((s) => (s.id === id ? { ...s, title } : s)) });
    }
  }

  // ── 챗 조작(활성 세션·서브 대상) ───────────────────────
  function handleClear() {
    if (!activeSession || !activeSub) return;
    resetStream();
    updateSubMessages(activeSession.id, activeSub.id, () => []);
  }

  // 카드 제안 칩 — 답에서 나온 용어를 카드로 저장(출처=세션명). 저장 후 해당 블록 제거.
  function handleCardAction(messageIndex: number, action: { add?: SuggestedCard; dismiss?: boolean }) {
    if (!activeSession || !activeSub) return;
    if (action.add) {
      const source = activeSession.title || t("ask.cardSource");
      createChatCard(action.add.kind ?? "term", action.add.term, action.add.definition, source, undefined, {});
    }
    const addedTerm = action.add?.term;
    updateSubMessages(activeSession.id, activeSub.id, (msgs) =>
      msgs.map((m, i) =>
        i === messageIndex && m.role === "assistant"
          ? { ...m, content: addedTerm ? removeSuggestedCard(m.content, addedTerm) : stripCardBlock(m.content) }
          : m,
      ),
    );
  }

  function handleSend(text: string) {
    if (loading || !activeSession || !activeSub) return;
    const sessionId = activeSession.id;
    const subId = activeSub.id;
    const thread: ChatMessage[] = [...activeSub.messages, { role: "user", content: text }];
    updateSubMessages(sessionId, subId, () => thread);
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
            updateSubMessages(sessionId, subId, (m) => [...m, { role: "assistant", content: t("chat.replyFailed") }]);
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
          updateSubMessages(sessionId, subId, (m) => [...m, { role: "assistant", content: answer || "(빈 응답)" }]);
        }
      } catch {
        if (!ac.signal.aborted) {
          updateSubMessages(sessionId, subId, (m) => [...m, { role: "assistant", content: t("chat.replyError") }]);
        }
      } finally {
        if (!ac.signal.aborted) { setStreaming(null); setLoading(false); }
      }
    })();
  }

  return (
    <div aria-hidden={!active} className="flex h-full w-full overflow-hidden">
      {/* 좌측 세션 히스토리 패널 */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#13141b]">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <IconMessage2 size={15} stroke={2} aria-hidden />
            {t("ask.sessions")}
          </span>
          <button
            type="button"
            onClick={handleNewSession}
            aria-label={t("ask.newSession")}
            title={t("ask.newSession")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <IconPlus size={16} stroke={2} aria-hidden />
          </button>
        </div>
        <div className="nunopi-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {store.sessions.map((s: AskSession) => {
            const selected = s.id === store.activeSessionId;
            const renaming = s.id === renamingId;
            return (
              <div
                key={s.id}
                className={`group mb-0.5 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                  selected
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                }`}
              >
                {renaming ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => commitRename(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(s.id);
                      else if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-sm outline-none focus:border-[#3B34E2] dark:border-zinc-600 dark:bg-zinc-900"
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelectSession(s.id)}
                      onDoubleClick={() => { setRenamingId(s.id); setRenameDraft(s.title); }}
                      className="min-w-0 flex-1 truncate text-left"
                      title={s.title || t("ask.untitled")}
                    >
                      {s.title || t("ask.untitled")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRenamingId(s.id); setRenameDraft(s.title); }}
                      aria-label={t("ask.rename")}
                      title={t("ask.rename")}
                      className="hidden shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-700 group-hover:block dark:hover:text-zinc-100"
                    >
                      <IconPencil size={14} stroke={2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(s.id)}
                      aria-label={t("ask.deleteSession")}
                      title={t("ask.deleteSession")}
                      className="hidden shrink-0 rounded p-0.5 text-zinc-400 hover:text-rose-500 group-hover:block"
                    >
                      <IconTrash size={14} stroke={2} aria-hidden />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* 우측 활성 세션 작업공간(단일 챗 — 서브세션 탭/분할은 이슈3/4). */}
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-4 py-6">
        <div className="mb-4 flex shrink-0 items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          {activeSession?.title || t("ask.title")}
        </div>
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
    </div>
  );
}
