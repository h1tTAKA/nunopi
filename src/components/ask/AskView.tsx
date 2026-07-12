"use client";

import { useEffect, useRef, useState } from "react";
import { IconMessage2, IconPlus, IconPencil, IconTrash, IconChevronRight, IconChevronDown, IconX } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import AskChat from "@/components/ask/AskChat";
import {
  loadAskStore,
  saveAskStore,
  createSession,
  newAskId,
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
  const confirm = useConfirm();
  const [store, setStore] = useState<AskStore>(EMPTY_STORE);
  // 스트리밍/로딩은 질문(서브세션)별로 관리 — 분할 타일 동시 답변 지원(이슈4).
  const [streamingMap, setStreamingMap] = useState<Record<string, string | null>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // 좌측 트리에서 펼쳐진(서브세션 노출) 세션 id 집합.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // storeRef — async 완료 시 stale 클로저 없이 최신 store를 읽고 커밋하기 위함.
  const storeRef = useRef<AskStore>(EMPTY_STORE);
  // 질문별 진행 요청 — 타일마다 독립 abort.
  const abortMap = useRef<Map<string, AbortController>>(new Map());
  // Escape 취소 플래그 — Escape가 input을 blur시키므로, 뒤따르는 onBlur 커밋을 건너뛴다.
  const renameCancelRef = useRef(false);

  // 마운트 시 세션 로드(항상 활성 세션 1개 보장). 언마운트 시 진행 요청 취소.
  useEffect(() => {
    const loaded = loadAskStore(t("ask.untitled"));
    storeRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(loaded);
    // 활성 세션은 펼친 상태로 시작(그 하위 대화 노출).
    setExpanded(new Set([loaded.activeSessionId]));
    const aborts = abortMap.current;
    return () => aborts.forEach((a) => a.abort());
    // t는 로케일 변경 시 바뀌지만 초기 제목에만 쓰여 재로드 불필요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cmd/Ctrl+D — 활성 모드에서 분할(현재 질문 옆 새 질문 타일). 브라우저 북마크 가로채기 방지.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleSplit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handleSplit은 storeRef만 읽어 안정적 — active만 의존.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // 최신 store를 ref+state+localStorage에 한 번에 반영.
  function commit(next: AskStore) {
    storeRef.current = next;
    setStore(next);
    saveAskStore(next);
  }

  const activeSession = store.sessions.find((s) => s.id === store.activeSessionId) ?? store.sessions[0] ?? null;

  // 질문(서브세션) 표시 라벨 — 유저 지정 이름 우선, 없으면 "질문 N"(세션 내 순번).
  function subDisplayLabel(session: AskSession, subId: string): string {
    const idx = session.subs.findIndex((sub) => sub.id === subId);
    const sub = session.subs[idx];
    return sub?.title || t("ask.thread", { n: Math.max(0, idx) + 1 });
  }

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

  // 특정 세션 하나를 mapper로 갱신하고 커밋(서브세션 조작용).
  function updateSession(sessionId: string, mapper: (s: AskSession) => AskSession) {
    const prev = storeRef.current;
    commit({ ...prev, sessions: prev.sessions.map((s) => (s.id !== sessionId ? s : mapper(s))) });
  }

  // 특정 질문의 진행 요청만 취소.
  function abortSub(subId: string) {
    abortMap.current.get(subId)?.abort();
    abortMap.current.delete(subId);
  }

  // 모든 진행 요청 취소 + 스트림 상태 초기화(세션/질문 네비게이션 시).
  function resetStream() {
    abortMap.current.forEach((a) => a.abort());
    abortMap.current.clear();
    setStreamingMap({});
    setLoadingMap({});
  }

  function expand(id: string) {
    setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── 세션 조작 ──────────────────────────────────────────
  function handleNewSession() {
    resetStream();
    const session = createSession(t("ask.untitled"));
    commit({ sessions: [...store.sessions, session], activeSessionId: session.id });
    expand(session.id);
  }

  function handleSelectSession(id: string) {
    expand(id);
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
      expand(fresh.id);
      return;
    }
    const activeSessionId = store.activeSessionId === id ? remaining[remaining.length - 1].id : store.activeSessionId;
    commit({ sessions: remaining, activeSessionId });
  }

  // rename 커밋은 항상 onBlur 한 경로로만 일어난다(Enter/Escape는 blur를 유발).
  function commitRename(id: string) {
    setRenamingId(null);
    if (renameCancelRef.current) {
      renameCancelRef.current = false; // Escape 취소 — 커밋 안 함.
      return;
    }
    const title = renameDraft.trim();
    if (title) {
      commit({ ...store, sessions: store.sessions.map((s) => (s.id === id ? { ...s, title } : s)) });
    }
  }

  // ── 서브세션(대화) 조작 — 좌측 트리에서 세션 지목 ──────
  function handleNewSub(sessionId: string) {
    resetStream();
    const sub = { id: newAskId(), messages: [] };
    const prev = storeRef.current;
    commit({
      ...prev,
      activeSessionId: sessionId,
      sessions: prev.sessions.map((s) =>
        s.id !== sessionId ? s : { ...s, subs: [...s.subs, sub], activeSubId: sub.id, layout: [sub.id] },
      ),
    });
    expand(sessionId);
  }

  function handleSelectSub(sessionId: string, subId: string) {
    if (sessionId === store.activeSessionId && subId === activeSession?.activeSubId) return;
    resetStream();
    const prev = storeRef.current;
    commit({
      ...prev,
      activeSessionId: sessionId,
      sessions: prev.sessions.map((s) => (s.id !== sessionId ? s : { ...s, activeSubId: subId, layout: [subId] })),
    });
  }

  function handleDeleteSub(sessionId: string, subId: string) {
    abortSub(subId);
    updateSession(sessionId, (s) => {
      const subs = s.subs.filter((sub) => sub.id !== subId);
      if (subs.length === 0) return s; // 최소 1 보장(트리가 >1일 때만 삭제 노출)
      const activeSubId = s.activeSubId === subId ? subs[subs.length - 1].id : s.activeSubId;
      const layoutLeft = s.layout.filter((id) => id !== subId && subs.some((x) => x.id === id));
      return { ...s, subs, activeSubId, layout: layoutLeft.length ? layoutLeft : [activeSubId] };
    });
  }

  // ── 분할(Cmd+D) 타일 조작 ──────────────────────────────
  function handleSplit() {
    const prev = storeRef.current;
    const session = prev.sessions.find((s) => s.id === prev.activeSessionId);
    if (!session || session.layout.length >= 4) return; // 상한 4(그리드 안정)
    const sub = { id: newAskId(), title: undefined, messages: [] };
    commit({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id !== session.id ? s : { ...s, subs: [...s.subs, sub], activeSubId: sub.id, layout: [...s.layout, sub.id] },
      ),
    });
    expand(session.id);
  }

  function closeTile(subId: string) {
    abortSub(subId);
    const sessionId = storeRef.current.activeSessionId;
    updateSession(sessionId, (s) => {
      const layout = s.layout.filter((id) => id !== subId);
      const nextLayout = layout.length ? layout : [s.activeSubId];
      const activeSubId = s.activeSubId === subId ? nextLayout[nextLayout.length - 1] : s.activeSubId;
      return { ...s, layout: nextLayout, activeSubId };
    });
  }

  function focusTile(subId: string) {
    const prev = storeRef.current;
    const session = prev.sessions.find((s) => s.id === prev.activeSessionId);
    if (!session || session.activeSubId === subId) return;
    updateSession(session.id, (s) => ({ ...s, activeSubId: subId }));
  }

  // 질문(서브세션) rename — 세션 rename과 동일 패턴(blur 단일 커밋 + 취소 플래그).
  function commitRenameSub(sessionId: string, subId: string) {
    setRenamingId(null);
    if (renameCancelRef.current) {
      renameCancelRef.current = false;
      return;
    }
    const title = renameDraft.trim();
    updateSession(sessionId, (s) => ({
      ...s,
      subs: s.subs.map((sub) => (sub.id === subId ? { ...sub, title: title || undefined } : sub)),
    }));
  }

  async function confirmDeleteSub(sessionId: string, subId: string) {
    if (await confirm({ title: t("ask.confirmDeleteThreadTitle"), message: t("ask.confirmDeleteThread"), confirmText: t("common.delete"), danger: true })) {
      handleDeleteSub(sessionId, subId);
    }
  }

  // ── 챗 조작(질문 subId 지목 — 타일별 독립) ─────────────
  function handleClearSub(subId: string) {
    abortSub(subId);
    setStreamingMap((m) => ({ ...m, [subId]: null }));
    setLoadingMap((m) => ({ ...m, [subId]: false }));
    updateSubMessages(storeRef.current.activeSessionId, subId, () => []);
  }

  // 카드 제안 칩 — 답에서 나온 용어를 카드로 저장(출처=세션명). 저장 후 해당 블록 제거.
  function handleCardActionSub(subId: string, messageIndex: number, action: { add?: SuggestedCard; dismiss?: boolean }) {
    const prev = storeRef.current;
    const session = prev.sessions.find((s) => s.id === prev.activeSessionId);
    if (!session) return;
    if (action.add) {
      const source = session.title || t("ask.cardSource");
      createChatCard(action.add.kind ?? "term", action.add.term, action.add.definition, source, undefined, {});
    }
    const addedTerm = action.add?.term;
    updateSubMessages(session.id, subId, (msgs) =>
      msgs.map((m, i) =>
        i === messageIndex && m.role === "assistant"
          ? { ...m, content: addedTerm ? removeSuggestedCard(m.content, addedTerm) : stripCardBlock(m.content) }
          : m,
      ),
    );
  }

  function handleSendTo(subId: string, text: string) {
    if (loadingMap[subId]) return;
    const prev = storeRef.current;
    const session = prev.sessions.find((s) => s.id === prev.activeSessionId);
    const sub = session?.subs.find((x) => x.id === subId);
    if (!session || !sub) return;
    const sessionId = session.id;
    const thread: ChatMessage[] = [...sub.messages, { role: "user", content: text }];
    updateSubMessages(sessionId, subId, () => thread);
    setStreamingMap((m) => ({ ...m, [subId]: "" }));
    setLoadingMap((m) => ({ ...m, [subId]: true }));
    abortSub(subId);
    const ac = new AbortController();
    abortMap.current.set(subId, ac);
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
            if (ev.type === "progress" && providerId !== "codex-agent") setStreamingMap((m) => ({ ...m, [subId]: ev.line }));
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
        if (!ac.signal.aborted) {
          setStreamingMap((m) => ({ ...m, [subId]: null }));
          setLoadingMap((m) => ({ ...m, [subId]: false }));
        }
        abortMap.current.delete(subId);
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
            const isActiveSession = s.id === store.activeSessionId;
            const renaming = s.id === renamingId;
            const isOpen = expanded.has(s.id);
            return (
              <div key={s.id} className="mb-0.5">
                {/* 세션(부모 폴더) 행 */}
                <div
                  className={`group flex items-center gap-0.5 rounded-lg pr-1 text-sm transition-colors ${
                    isActiveSession
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(s.id)}
                    aria-label={isOpen ? "접기" : "펼치기"}
                    className="flex h-7 w-6 shrink-0 items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {isOpen ? <IconChevronDown size={15} stroke={2} aria-hidden /> : <IconChevronRight size={15} stroke={2} aria-hidden />}
                  </button>
                  {renaming ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => commitRename(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        else if (e.key === "Escape") { renameCancelRef.current = true; e.currentTarget.blur(); }
                      }}
                      className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-sm outline-none focus:border-[#3B34E2] dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSelectSession(s.id)}
                        onDoubleClick={() => { setRenamingId(s.id); setRenameDraft(s.title); }}
                        className="min-w-0 flex-1 truncate py-1.5 text-left font-medium"
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

                {/* 서브세션(대화) — 세션 밑 들여쓰기 트리 */}
                {isOpen && (
                  <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-700/60">
                    {s.subs.map((sub, i) => {
                      const isActiveSub = isActiveSession && sub.id === s.activeSubId;
                      const subRenaming = sub.id === renamingId;
                      const subName = sub.title || t("ask.thread", { n: i + 1 });
                      return (
                        <div
                          key={sub.id}
                          className={`group/sub flex items-center gap-1 rounded-md px-2 py-1 text-[13px] transition-colors ${
                            isActiveSub
                              ? "bg-[#3B34E2]/10 font-medium text-[#3B34E2] dark:bg-[#8b86f5]/15 dark:text-[#8b86f5]"
                              : "text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                          }`}
                        >
                          {subRenaming ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={() => commitRenameSub(s.id, sub.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                else if (e.key === "Escape") { renameCancelRef.current = true; e.currentTarget.blur(); }
                              }}
                              className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-[13px] text-zinc-800 outline-none focus:border-[#3B34E2] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                            />
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSelectSub(s.id, sub.id)}
                                onDoubleClick={() => { setRenamingId(sub.id); setRenameDraft(subName); }}
                                className="min-w-0 flex-1 truncate text-left"
                                title={subName}
                              >
                                {subName}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRenamingId(sub.id); setRenameDraft(subName); }}
                                aria-label={t("ask.rename")}
                                title={t("ask.rename")}
                                className="hidden shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-700 group-hover/sub:block dark:hover:text-zinc-100"
                              >
                                <IconPencil size={12} stroke={2} aria-hidden />
                              </button>
                              {s.subs.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => { void confirmDeleteSub(s.id, sub.id); }}
                                  aria-label={t("ask.deleteThread")}
                                  className="hidden shrink-0 rounded p-0.5 text-zinc-400 hover:text-rose-500 group-hover/sub:block"
                                >
                                  <IconX size={12} stroke={2.5} aria-hidden />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => handleNewSub(s.id)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
                    >
                      <IconPlus size={13} stroke={2.5} aria-hidden />
                      {t("ask.newThread")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* 우측 활성 세션 작업공간 — layout에 따라 단일 챗 또는 분할 타일 그리드. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {(() => {
          if (!activeSession) return null;
          // layout의 유효한 질문만(삭제된 id 방어). 비면 활성 서브로 폴백.
          const tileIds = activeSession.layout.filter((id) => activeSession.subs.some((sub) => sub.id === id));
          const ids = tileIds.length ? tileIds : [activeSession.activeSubId];
          const sessionTitle = activeSession.title || t("ask.title");

          const renderTile = (subId: string, tiled: boolean) => {
            const sub = activeSession.subs.find((x) => x.id === subId) ?? activeSession.subs[0];
            return (
              <AskChat
                key={sub.id}
                title={sessionTitle}
                subLabel={subDisplayLabel(activeSession, sub.id)}
                messages={sub.messages}
                streaming={streamingMap[sub.id] ?? null}
                isLoading={!!loadingMap[sub.id]}
                onSend={(text) => handleSendTo(sub.id, text)}
                onClear={() => handleClearSub(sub.id)}
                onCardAction={(i, action) => handleCardActionSub(sub.id, i, action)}
                onSplit={handleSplit}
                tiled={tiled}
                focused={tiled ? sub.id === activeSession.activeSubId : false}
                onFocus={tiled ? () => focusTile(sub.id) : undefined}
                onClose={tiled ? () => closeTile(sub.id) : undefined}
              />
            );
          };

          if (ids.length <= 1) {
            return <div className="h-full">{renderTile(ids[0], false)}</div>;
          }
          return (
            <div className="grid h-full grid-cols-2 gap-2 p-2">
              {ids.map((id) => (
                <div key={id} className="min-h-0 overflow-hidden">
                  {renderTile(id, true)}
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
