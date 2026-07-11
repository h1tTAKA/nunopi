"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconSparkles, IconX, IconSend2, IconCheck, IconMinus, IconEye } from "@tabler/icons-react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import Markdown from "@/components/learning/Markdown";
import { collectCards } from "@/lib/srs/collect";
import { addCustomDeck } from "@/lib/srs/customDeck";
import { buildDeckSelectContext, parseDeckSelect, stripDeckSelect, stripDeckSelectStreaming } from "@/lib/deckSelect";
import { DECK_SOURCES, type Card } from "@/lib/srs/types";
import { useFlyCard } from "./FlyCard";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";

const SYMBOL = "/brand/nunopi-symbol-darkeye-transparent.png";
type StreamEvent = { type: "progress"; line: string } | { type: "result"; response: { summary: string } } | { type: "error"; message: string };

// 제안 덱마다 안정적 유니크 id — 재제안(덱 수 변동) 시 React key 재사용 방지.
let deckIdSeq = 0;
function newDeckId(): string {
  try { return crypto.randomUUID(); } catch { deckIdSeq += 1; return `deck-${deckIdSeq}`; }
}

// 에이전트가 제안한 덱(로컬 편집 상태) — 제목·체크·덱별 제외.
interface ProposalDeck {
  id: string;
  name: string;
  cards: Card[];
  checked: boolean;
  excluded: Set<string>;
}

// 에이전트 덱 커스터마이징 — 대화형. 상담도 하고, 덱을 만들자 하면 에이전트가 하나 또는 여러 덱을
// 제안(chat 재사용) → 좌측에 덱 섹션으로 stagger 리빌 → 제목 편집/제외/체크 → 덱 추가하기.
export default function AgentDeckModal({
  now, providerId, providerSettings, onBack, onCreated,
}: {
  now: Date;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
  onBack: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { throwCard } = useFlyCard();
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const all = useMemo(() => collectCards(DECK_SOURCES.all, now), [now]);
  const byKey = useMemo(() => new Map(all.map((c) => [c.key, c])), [all]);
  const context = useMemo(() => buildDeckSelectContext(all), [all]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null); // 실시간 타이핑 텍스트
  const [decks, setDecks] = useState<ProposalDeck[]>([]);
  const [reveal, setReveal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  // 대화/로딩 갱신 시 맨 아래로.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, loading, streaming]);

  const totalCards = useMemo(() => decks.reduce((n, d) => n + d.cards.length, 0), [decks]);

  // 선별 결과가 바뀌면 stagger 리빌(전역 카드 인덱스, 애니 카운터라 effect 내 setState 의도적).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (totalCards === 0) { setReveal(0); return; }
    if (reduced) { setReveal(totalCards); return; }
    setReveal(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setReveal(i);
      if (i >= totalCards) window.clearInterval(id);
    }, 110);
    return () => window.clearInterval(id);
  }, [totalCards, reduced]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const thread: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(thread);
    setInput("");
    setLoading(true);
    setStreaming("");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          request: { code: context, locale, providerId, mode: "chat", messages: thread, providerSettings },
        }),
        signal: ac.signal,
      });
      let answer = "";
      if (res.ok && res.body) {
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
            try {
              const ev = JSON.parse(l) as StreamEvent;
              // codex는 진행 라벨만 흘리므로 타이핑에 안 씀(claude/openai만 전체 답 스트림).
              if (ev.type === "progress" && providerId !== "codex-agent") setStreaming(ev.line);
              else if (ev.type === "result") answer = ev.response.summary;
            } catch { /* skip */ }
          }
        }
        if (buffer.trim()) { try { const ev = JSON.parse(buffer) as StreamEvent; if (ev.type === "result") answer = ev.response.summary; } catch { /* skip */ } }
      }
      if (ac.signal.aborted) return;
      const reply = answer || t("mem.agentDeckNone");
      // 덱 선별 블록이 있으면 좌측을 새 제안으로 교체(잔여 상태 누수 방지). 본문(블록 제거)만 대화에 표시.
      const proposals = parseDeckSelect(reply);
      const built: ProposalDeck[] = proposals
        .map((p) => {
          const cards = p.keys.map((k) => byKey.get(k)).filter((c): c is Card => !!c);
          return { id: newDeckId(), name: p.name, cards, checked: true, excluded: new Set<string>() };
        })
        .filter((d) => d.cards.length > 0);
      if (built.length > 0) setDecks(built);
      setMessages([...thread, { role: "assistant", content: stripDeckSelect(reply) || t("mem.agentDeckNone") }]);
    } catch {
      if (!ac.signal.aborted) setMessages([...thread, { role: "assistant", content: t("mem.agentDeckNone") }]);
    } finally {
      if (!ac.signal.aborted) { setLoading(false); setStreaming(null); }
    }
  }

  function toggleExclude(deckId: string, key: string) {
    setDecks((prev) => prev.map((d) => {
      if (d.id !== deckId) return d;
      const ex = new Set(d.excluded);
      if (ex.has(key)) ex.delete(key); else ex.add(key);
      return { ...d, excluded: ex };
    }));
  }
  function toggleChecked(deckId: string) {
    setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, checked: !d.checked } : d)));
  }
  function renameDeck(deckId: string, name: string) {
    setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, name } : d)));
  }
  const allChecked = decks.length > 0 && decks.every((d) => d.checked);
  const someChecked = decks.some((d) => d.checked);
  function toggleAll() {
    const next = !allChecked;
    setDecks((prev) => prev.map((d) => ({ ...d, checked: next })));
  }

  const includedCount = (d: ProposalDeck) => d.cards.filter((c) => !d.excluded.has(c.key)).length;
  const checkedCount = decks.filter((d) => d.checked).length;
  // 추가 가능 = 체크된 덱 중 카드가 하나라도 남은 게 있을 때.
  const canAdd = decks.some((d) => d.checked && includedCount(d) > 0);

  function addChecked() {
    if (!canAdd) return;
    const goal = messages.find((m) => m.role === "user")?.content;
    for (const d of decks) {
      if (!d.checked) continue;
      const keys = d.cards.filter((c) => !d.excluded.has(c.key)).map((c) => c.key);
      if (keys.length === 0) continue;
      addCustomDeck(d.name || t("mem.agentDeckTitle"), keys, goal);
    }
    onCreated();
  }

  // 덱 렌더 시작 전까지 누적된 카드 수(전역 stagger 인덱스 계산용).
  let flatOffset = 0;

  return (
    <div className="absolute inset-0 z-10 flex bg-black/50 backdrop-blur-sm">
      {/* 좌: 제안 덱 프리뷰(덱 섹션 + stagger) */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-zinc-200 bg-zinc-50/95 dark:border-zinc-800 dark:bg-[#0b0c10]/95">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t("mem.agentDeckDecksTitle")}</span>
          {decks.length > 0 && <span className="text-xs text-zinc-400 dark:text-zinc-500">{decks.length}</span>}
          {totalCards > 0 && <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">{t("mem.agentDeckExcludeHint")}</span>}
        </div>
        <div className="nunopi-scroll flex-1 overflow-y-auto p-5">
          {decks.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
              {t("mem.agentDeckEmpty")}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {decks.map((d) => {
                const offset = flatOffset;
                flatOffset += d.cards.length;
                return (
                  <section key={d.id} className="flex flex-col gap-2.5">
                    {/* 덱 섹션 헤더 — 체크박스 + 제목 편집 + 포함 카드 수 */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={d.checked}
                        onClick={() => toggleChecked(d.id)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${d.checked ? "border-[#3B34E2] bg-[#3B34E2] text-white" : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"}`}
                      >
                        {d.checked && <IconCheck size={13} stroke={3} aria-hidden />}
                      </button>
                      <input
                        value={d.name}
                        onChange={(e) => renameDeck(d.id, e.target.value)}
                        placeholder={t("mem.deckNamePlaceholder")}
                        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-zinc-800 outline-none hover:border-zinc-200 focus:border-[#3B34E2] dark:text-zinc-100 dark:hover:border-zinc-700"
                      />
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{includedCount(d)}</span>
                    </div>
                    {/* 카드 그리드 */}
                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))" }}>
                      {d.cards.map((c, i) => {
                        if (offset + i >= reveal) return null;
                        const ex = d.excluded.has(c.key);
                        return (
                          // 컨테이너(비대화형) — 클릭 동작은 안의 실제 버튼 둘이 담당(중첩 회피).
                          <div
                            key={c.key}
                            data-fly-card
                            className={`group relative aspect-[5/7] overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 ${
                              ex ? "border-zinc-300 dark:border-zinc-600" : "border-[#3B34E2]/50"
                            }`}
                            style={reduced ? undefined : { animation: "nunopi-pop 260ms ease-out both" }}
                          >
                            <span className="pointer-events-none absolute inset-[6%] rounded-[10%] border-2 border-blue-500/55" />
                            <span className="pointer-events-none absolute inset-[9%] rounded-[8%] border border-blue-500/30" />
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2.5 text-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={SYMBOL} alt="" className="h-5 w-5 object-contain" />
                              <span className="line-clamp-3 text-[11px] font-bold leading-tight text-zinc-900">{c.front}</span>
                            </div>
                            {/* 전면 커버 제외 토글(실제 버튼) — 카드 아무데나 클릭 시 포함/제외 */}
                            <button
                              type="button"
                              aria-label={c.front}
                              aria-pressed={!ex}
                              onClick={() => toggleExclude(d.id, c.key)}
                              className="absolute inset-0 z-10 cursor-pointer rounded-2xl"
                            />
                            {/* 제외 시 은은한 뮤트 */}
                            {ex && <span className="pointer-events-none absolute inset-0 z-20 rounded-2xl bg-zinc-900/45" />}
                            {/* 우상단 포함/제외 체크(표시용) */}
                            <span className={`pointer-events-none absolute right-1.5 top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded-full border ${ex ? "border-zinc-300 bg-white/80" : "border-[#3B34E2] bg-[#3B34E2] text-white"}`}>
                              {!ex && <IconCheck size={12} stroke={3} aria-hidden />}
                            </span>
                            {/* 호버 시 카드 정중앙 "카드 보기"(회색) — 클릭하면 카드가 날아오며 전체 정보(토글 버튼 위, 형제) */}
                            {!ex && (
                              <button
                                type="button"
                                onClick={(e) => throwCard(c, (e.currentTarget.closest("[data-fly-card]") as HTMLElement | null)?.getBoundingClientRect())}
                                className="absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-lg bg-zinc-700/90 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-md transition hover:bg-zinc-800 group-hover:opacity-100"
                              >
                                <IconEye size={13} stroke={2} aria-hidden />
                                {t("mem.cardDetail")}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
        {/* 좌측 하단 — 전체 선택 + 덱 추가하기 */}
        {decks.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <button
              type="button"
              role="checkbox"
              aria-checked={allChecked ? true : someChecked ? "mixed" : false}
              onClick={toggleAll}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${someChecked ? "border-[#3B34E2] bg-[#3B34E2] text-white" : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"}`}
            >
              {allChecked ? <IconCheck size={13} stroke={3} aria-hidden /> : someChecked ? <IconMinus size={13} stroke={3} aria-hidden /> : null}
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("mem.selectAllDecks")}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{checkedCount}/{decks.length}</span>
            <button
              type="button"
              onClick={addChecked}
              disabled={!canAdd}
              className="ml-auto shrink-0 rounded-lg bg-[#3B34E2] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9] disabled:opacity-40"
            >
              {t("mem.addDecks")}
            </button>
          </div>
        )}
      </div>

      {/* 우: 대화형 프롬프트 */}
      <div className="flex w-80 shrink-0 flex-col bg-white dark:bg-[#15161d]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <IconSparkles size={15} stroke={2} className="text-[#3B34E2] dark:text-[#8b86f5]" aria-hidden /> {t("mem.agentDeckTitle")}
          </span>
          <button type="button" onClick={onBack} aria-label={t("mem.agentDeckReject")} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <IconX size={16} stroke={2} aria-hidden />
          </button>
        </div>
        {/* 대화 로그 */}
        <div ref={logRef} className="nunopi-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-xs">
          <div className="max-w-[90%] self-start rounded-2xl bg-zinc-100 px-3 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {t("mem.agentDeckGreet")}
          </div>
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[90%] self-end whitespace-pre-wrap rounded-2xl bg-blue-500 px-3 py-2 text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className="max-w-[90%] self-start rounded-2xl bg-zinc-100 px-3 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Markdown>{m.content}</Markdown>
              </div>
            ),
          )}
          {streaming != null && (
            <div className="max-w-[90%] self-start rounded-2xl bg-zinc-100 px-3 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {streaming ? <Markdown>{stripDeckSelectStreaming(streaming)}</Markdown> : <span className="text-zinc-400 dark:text-zinc-500">{t("chat.replying")}</span>}
            </div>
          )}
        </div>
        {/* 입력 */}
        <div className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            disabled={loading}
            rows={1}
            placeholder={t("mem.agentDeckPlaceholder")}
            className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-[#3B34E2] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="button"
            onClick={() => { void send(); }}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-xl bg-[#3B34E2] p-2.5 text-white transition hover:bg-[#322bc9] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t("chat.send")}
          >
            <IconSend2 size={16} stroke={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
