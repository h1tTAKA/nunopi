"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconSparkles, IconX, IconSend2, IconCheck, IconEye } from "@tabler/icons-react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import Markdown from "@/components/learning/Markdown";
import { collectCards } from "@/lib/srs/collect";
import { addCardsToDeck, loadCustomDecks, CUSTOM_DECKS_CHANGED_EVENT, type CustomDeck } from "@/lib/srs/customDeck";
import { buildDeckAssignContext, parseDeckAssign, stripDeckAssign, stripDeckAssignStreaming } from "@/lib/deckAssign";
import { DECK_SOURCES, type Card } from "@/lib/srs/types";
import { cardFrame } from "@/lib/srs/cardFrame";
import { useFlyCard } from "./FlyCard";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";

const SYMBOL = "/brand/nunopi-symbol-darkeye-transparent.png";
type StreamEvent = { type: "progress"; line: string } | { type: "thinking"; line: string } | { type: "result"; response: { summary: string } } | { type: "error"; message: string };

// 에이전트가 제안한 배정 그룹 — 기존 덱(고정) + 그 덱에 넣을 카드.
interface AssignGroup {
  deckId: string;
  deckName: string;
  cards: Card[];
  checked: boolean;
  excluded: Set<string>;
}

// 미니 카드 타일(setup 후보 선택 / preview 배정 결과 공용). dimmed=흐리게, check=우상단 파란 체크.
function MiniTile({ card, dimmed, check, onToggle, throwCard, t }: {
  card: Card; dimmed: boolean; check: boolean; onToggle: () => void;
  throwCard: (c: Card, r?: DOMRect) => void; t: (k: string) => string;
}) {
  return (
    <div data-fly-card className={`group relative aspect-[5/7] overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 ${dimmed ? "border-zinc-300 dark:border-zinc-600" : "border-[#3B34E2]/50"}`}>
      <span className={`pointer-events-none absolute inset-[6%] rounded-[10%] border-2 ${cardFrame(card.source).outer}`} />
      <span className={`pointer-events-none absolute inset-[9%] rounded-[8%] border ${cardFrame(card.source).inner}`} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2.5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SYMBOL} alt="" className="h-5 w-5 object-contain" />
        <span className="line-clamp-3 text-[11px] font-bold leading-tight text-zinc-900">{card.front}</span>
      </div>
      <button type="button" aria-label={card.front} aria-pressed={check} onClick={onToggle} className="absolute inset-0 z-10 cursor-pointer rounded-2xl" />
      {dimmed && <span className="pointer-events-none absolute inset-0 z-20 rounded-2xl bg-zinc-900/45" />}
      <span className={`pointer-events-none absolute right-1.5 top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded-full border ${check ? "border-[#3B34E2] bg-[#3B34E2] text-white" : "border-zinc-300 bg-white/80"}`}>
        {check && <IconCheck size={12} stroke={3} aria-hidden />}
      </span>
      {!dimmed && (
        <button
          type="button"
          onClick={(e) => throwCard(card, (e.currentTarget.closest("[data-fly-card]") as HTMLElement | null)?.getBoundingClientRect())}
          className="absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-lg bg-zinc-700/90 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-md transition hover:bg-zinc-800 group-hover:opacity-100"
        >
          <IconEye size={13} stroke={2} aria-hidden /> {t("mem.cardDetail")}
        </button>
      )}
    </div>
  );
}

// 에이전트 기존 덱 자동 분류 — UI 주도 2단계.
// setup: 왼쪽에서 분류할 카드(미분류 기본)·대상 덱 고르기 → "맡기기". preview: 에이전트 배정 제안 → 제외/체크 → 추가.
export default function AgentAssignModal({
  now, providerId, providerSettings, onBack, onApplied, embedded = false, headerRight,
}: {
  now: Date;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
  onBack: () => void;
  onApplied: () => void;
  // embedded=허브 패널 안에 끼워질 때: 자체 백드롭/풀스크린 제거하고 부모 박스를 채운다.
  embedded?: boolean;
  // 우측 컬럼 헤더의 제목 자리에 끼울 요소(허브의 모드 토글).
  headerRight?: React.ReactNode;
}) {
  const t = useT();
  const { locale } = useLocale();
  const confirm = useConfirm();
  const { throwCard } = useFlyCard();
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const all = useMemo(() => collectCards(DECK_SOURCES.all, now), [now]);
  const byKey = useMemo(() => new Map(all.map((c) => [c.key, c])), [all]);
  const [existingDecks, setExistingDecks] = useState<CustomDeck[]>([]);
  useEffect(() => {
    const load = () => setExistingDecks(loadCustomDecks());
    load();
    window.addEventListener(CUSTOM_DECKS_CHANGED_EVENT, load);
    return () => window.removeEventListener(CUSTOM_DECKS_CHANGED_EVENT, load);
  }, []);

  // 미분류 = 전체 − 모든 덱 cardKeys 합집합.
  const assignedKeys = useMemo(() => new Set(existingDecks.flatMap((d) => d.cardKeys)), [existingDecks]);
  const [scope, setScope] = useState<"unassigned" | "all">("unassigned");
  const candidates = useMemo(
    () => (scope === "unassigned" ? all.filter((c) => !assignedKeys.has(c.key)) : all),
    [all, assignedKeys, scope],
  );

  // 선택 상태 — 카드/덱(기본 전체 선택). 배정 결과 유무와 무관하게 옵션 패널은 항상 유지.
  const [pickedCards, setPickedCards] = useState<Set<string>>(new Set());
  const [pickedDecks, setPickedDecks] = useState<Set<string>>(new Set());
  // 후보/덱 목록 바뀌면 기본 전체 선택으로 초기화.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setPickedCards(new Set(candidates.map((c) => c.key))); }, [candidates]);
  useEffect(() => { setPickedDecks(new Set(existingDecks.map((d) => d.id))); }, [existingDecks]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [thinking, setThinking] = useState("");
  const [groups, setGroups] = useState<AssignGroup[]>([]);
  const [reveal, setReveal] = useState(0);
  // 요청 시점의 선택 범위(컨텍스트 고정) — preview에서 자유 대화 시에도 이 범위 유지.
  const ctxRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, loading, streaming, thinking]);

  const totalCards = useMemo(() => groups.reduce((n, g) => n + g.cards.length, 0), [groups]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (totalCards === 0) { setReveal(0); return; }
    if (reduced) { setReveal(totalCards); return; }
    setReveal(0);
    let i = 0;
    const id = window.setInterval(() => { i += 1; setReveal(i); if (i >= totalCards) window.clearInterval(id); }, 110);
    return () => window.clearInterval(id);
  }, [totalCards, reduced]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 에이전트 호출 — context(요청 시 고정)와 스레드로. answer 반환.
  async function runAgent(thread: ChatMessage[], context: string): Promise<string> {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setStreaming("");
    setThinking("");
    try {
      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, request: { code: context, locale, providerId, mode: "chat", messages: thread, providerSettings } }),
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
              if (ev.type === "progress" && providerId !== "codex-agent") setStreaming(ev.line);
              else if (ev.type === "thinking") setThinking(ev.line);
              else if (ev.type === "result") answer = ev.response.summary;
            } catch { /* skip */ }
          }
        }
        if (buffer.trim()) { try { const ev = JSON.parse(buffer) as StreamEvent; if (ev.type === "result") answer = ev.response.summary; } catch { /* skip */ } }
      }
      return ac.signal.aborted ? "" : answer;
    } finally {
      if (!ac.signal.aborted) { setLoading(false); setStreaming(null); setThinking(""); }
    }
  }

  // 응답을 배정 그룹으로 반영 + 대화 표시.
  function applyReply(thread: ChatMessage[], reply: string) {
    if (!reply) return;
    const assigns = parseDeckAssign(reply);
    const built: AssignGroup[] = [];
    for (const a of assigns) {
      const deck = existingDecks.find((d) => d.name === a.deck);
      if (!deck) continue;
      const has = new Set(deck.cardKeys);
      const cards = a.keys.map((k) => byKey.get(k)).filter((c): c is Card => !!c && !has.has(c.key));
      if (cards.length > 0) built.push({ deckId: deck.id, deckName: deck.name, cards, checked: true, excluded: new Set() });
    }
    if (built.length > 0) setGroups(built);
    setMessages([...thread, { role: "assistant", content: stripDeckAssign(reply) || t("mem.agentDeckNone") }]);
  }

  // "맡기기" — 선택 카드·덱으로 컨텍스트 구성 + 자동 요청 → preview.
  async function delegate() {
    if (loading) return;
    const cards = candidates.filter((c) => pickedCards.has(c.key));
    const decks = existingDecks.filter((d) => pickedDecks.has(d.id));
    if (cards.length === 0 || decks.length === 0) return;
    const context = buildDeckAssignContext(cards, decks.map((d) => ({ name: d.name, cardKeys: d.cardKeys })));
    ctxRef.current = context;
    const prompt = t("mem.assignAutoPrompt").replace("{n}", String(cards.length)).replace("{decks}", decks.map((d) => d.name).join(", "));
    const thread: ChatMessage[] = [{ role: "user", content: prompt }];
    setMessages(thread);
    try {
      const answer = await runAgent(thread, context);
      applyReply(thread, answer || t("mem.agentDeckNone"));
    } catch { applyReply(messages, t("mem.agentDeckNone")); }
  }

  // preview에서 자유 대화(미세조정) — 같은 컨텍스트 유지.
  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const thread: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(thread);
    setInput("");
    try {
      const answer = await runAgent(thread, ctxRef.current);
      applyReply(thread, answer || t("mem.agentDeckNone"));
    } catch { /* 무시(응답 없음) */ }
  }

  // setup 조작
  function toggleCard(key: string) {
    setPickedCards((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  function toggleDeck(id: string) {
    setPickedDecks((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  const allCardsPicked = candidates.length > 0 && candidates.every((c) => pickedCards.has(c.key));
  function toggleAllCards() {
    setPickedCards(allCardsPicked ? new Set() : new Set(candidates.map((c) => c.key)));
  }
  const allDecksPicked = existingDecks.length > 0 && existingDecks.every((d) => pickedDecks.has(d.id));
  function toggleAllDecks() {
    setPickedDecks(allDecksPicked ? new Set() : new Set(existingDecks.map((d) => d.id)));
  }

  // preview 조작
  function toggleExclude(deckId: string, key: string) {
    setGroups((prev) => prev.map((g) => {
      if (g.deckId !== deckId) return g;
      const ex = new Set(g.excluded); if (ex.has(key)) ex.delete(key); else ex.add(key); return { ...g, excluded: ex };
    }));
  }
  function toggleGroup(deckId: string) {
    setGroups((prev) => prev.map((g) => (g.deckId === deckId ? { ...g, checked: !g.checked } : g)));
  }
  const includedCount = (g: AssignGroup) => g.cards.filter((c) => !g.excluded.has(c.key)).length;
  const canApply = groups.some((g) => g.checked && includedCount(g) > 0);
  // 추가 완료 결과(팝업) — 확인 후 세팅. 닫으면 onApplied.
  const [result, setResult] = useState<{ decks: number; added: number; skipped: number } | null>(null);
  async function applyChecked() {
    if (!canApply) return;
    const targets = groups.filter((g) => g.checked && includedCount(g) > 0);
    const cardTotal = targets.reduce((n, g) => n + includedCount(g), 0);
    const ok = await confirm({
      title: t("mem.assignApplyConfirmTitle"),
      message: t("mem.assignApplyConfirmMsg").replace("{decks}", String(targets.length)).replace("{n}", String(cardTotal)),
      confirmText: t("mem.assignApply"),
    });
    if (!ok) return;
    let added = 0, skipped = 0;
    for (const g of targets) {
      const keys = g.cards.filter((c) => !g.excluded.has(c.key)).map((c) => c.key);
      const r = addCardsToDeck(g.deckId, keys);
      added += r.added; skipped += r.skipped;
    }
    setResult({ decks: targets.length, added, skipped });
  }

  const pickedCount = candidates.filter((c) => pickedCards.has(c.key)).length;
  // 그룹별 전역 stagger 시작 인덱스(이전 그룹들 카드 수 누적) — 렌더 밖에서 미리 계산.
  const groupOffsets = useMemo(() => {
    const o: number[] = [];
    let acc = 0;
    for (const g of groups) { o.push(acc); acc += g.cards.length; }
    return o;
  }, [groups]);

  return (
    <div className={embedded
      ? "absolute inset-0 flex overflow-hidden bg-white dark:bg-[#0b0c10]"
      : "absolute inset-0 z-10 flex bg-black/50 backdrop-blur-sm"}>
      {/* 좌: 옵션 패널(항상) + 본문(후보 그리드 ↔ 배정 결과) */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-zinc-200 bg-zinc-50/95 dark:border-zinc-800 dark:bg-[#0b0c10]/95">
        {/* 상단 옵션 패널 — 범위 토글·카드 선택·대상 덱·실행 버튼. 배정 결과와 무관하게 항상 유지. */}
        <div className="shrink-0 space-y-3 border-b border-zinc-200 bg-white/60 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t("mem.assignPickCards")}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{pickedCount}/{candidates.length}</span>
            <div className="ml-auto flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
              {(["unassigned", "all"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setScope(s)} disabled={loading}
                  className={`rounded-md px-2 py-1 font-medium transition disabled:opacity-50 ${scope === s ? "bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {t(s === "unassigned" ? "mem.assignScopeUnassigned" : "mem.assignScopeAll")}
                </button>
              ))}
            </div>
            <button type="button" onClick={toggleAllCards} disabled={loading} className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
              {allCardsPicked ? t("mem.selectNone") : t("mem.selectAll")}
            </button>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1.5 shrink-0 text-xs font-semibold text-zinc-600 dark:text-zinc-300">{t("mem.assignPickDecks")}</span>
            <div className="nunopi-scroll flex max-h-16 flex-1 flex-wrap gap-1.5 overflow-y-auto">
              {existingDecks.map((d) => {
                const on = pickedDecks.has(d.id);
                return (
                  <button key={d.id} type="button" onClick={() => toggleDeck(d.id)} disabled={loading}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${on ? "bg-[#3B34E2] text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"}`}>
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border ${on ? "border-white/70 bg-white/20" : "border-zinc-300 dark:border-zinc-600"}`}>
                      {on && <IconCheck size={10} stroke={3} aria-hidden />}
                    </span>
                    {d.name}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={toggleAllDecks} disabled={loading} className="mt-1.5 shrink-0 text-[11px] font-medium text-zinc-400 transition hover:text-zinc-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-300">
              {allDecksPicked ? t("mem.selectNone") : t("mem.selectAll")}
            </button>
          </div>
          {/* 실행 버튼 — 상태별 전환. 생각 중엔 비활성. 결과 있으면 [다시 고르기] + [선택 덱에 추가]. */}
          <div className="flex justify-end gap-2">
            {loading ? (
              <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-white opacity-60">
                <IconSparkles size={15} stroke={2} className={reduced ? undefined : "animate-pulse"} aria-hidden />
                {t("mem.assignSorting")}
              </button>
            ) : groups.length > 0 ? (
              <>
                <button type="button" onClick={() => { void delegate(); }} disabled={pickedCount === 0 || pickedDecks.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-lime-600 disabled:cursor-not-allowed disabled:opacity-40">
                  <IconSparkles size={14} stroke={2} aria-hidden />
                  {t("mem.assignReclassify")}
                </button>
                <button type="button" onClick={() => { void applyChecked(); }} disabled={!canApply}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
                  <IconCheck size={15} stroke={2.5} aria-hidden />
                  {t("mem.assignApply")}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { void delegate(); }} disabled={pickedCount === 0 || pickedDecks.size === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-lime-600 disabled:cursor-not-allowed disabled:opacity-40">
                <IconSparkles size={15} stroke={2} aria-hidden />
                {t("mem.assignDelegate")}
                <span className="font-normal text-white/70">{pickedCount}·{pickedDecks.size}</span>
              </button>
            )}
          </div>
        </div>

        {/* 본문 — 결과 있으면 덱별 배정, 생각 중(첫 제안)엔 안내, 아니면 후보 카드 그리드 */}
        <div className="nunopi-scroll flex-1 overflow-y-auto p-5">
          {groups.length > 0 ? (
            <div className={`flex flex-col gap-5 ${loading ? "opacity-50" : ""}`}>
              {groups.map((g, gi) => {
                const offset = groupOffsets[gi];
                return (
                  <section key={g.deckId} className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <button type="button" role="checkbox" aria-checked={g.checked} onClick={() => toggleGroup(g.deckId)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${g.checked ? "border-[#3B34E2] bg-[#3B34E2] text-white" : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"}`}>
                        {g.checked && <IconCheck size={13} stroke={3} aria-hidden />}
                      </button>
                      <span className="min-w-0 flex-1 truncate px-1.5 py-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{g.deckName}</span>
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">+{includedCount(g)}</span>
                    </div>
                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))" }}>
                      {g.cards.map((c, i) => {
                        if (offset + i >= reveal) return null;
                        const ex = g.excluded.has(c.key);
                        return <MiniTile key={c.key} card={c} dimmed={ex} check={!ex} onToggle={() => toggleExclude(g.deckId, c.key)} throwCard={throwCard} t={t} />;
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
              <IconSparkles size={22} stroke={2} className={reduced ? undefined : "animate-pulse"} aria-hidden />
              {t("mem.assignSorting")}
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400 dark:text-zinc-600">{t("mem.assignNoCards")}</div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))" }}>
              {candidates.map((c) => (
                <MiniTile key={c.key} card={c} dimmed={!pickedCards.has(c.key)} check={pickedCards.has(c.key)} onToggle={() => toggleCard(c.key)} throwCard={throwCard} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 우: 대화(보조) */}
      <div className="flex w-80 shrink-0 flex-col bg-white dark:bg-[#15161d]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
          {headerRight ?? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <IconSparkles size={15} stroke={2} className="text-[#3B34E2] dark:text-[#8b86f5]" aria-hidden /> {t("mem.assignTitle")}
            </span>
          )}
          <button type="button" onClick={onBack} aria-label={t("mem.agentDeckReject")} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <IconX size={16} stroke={2} aria-hidden />
          </button>
        </div>
        <div ref={logRef} className="nunopi-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-xs">
          <div className="max-w-[90%] self-start rounded-2xl bg-zinc-100 px-3 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {t("mem.assignGreet")}
          </div>
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[90%] self-end whitespace-pre-wrap rounded-2xl bg-blue-500 px-3 py-2 text-white">{m.content}</div>
            ) : (
              <div key={i} className="max-w-[90%] self-start rounded-2xl bg-zinc-100 px-3 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><Markdown>{m.content}</Markdown></div>
            ),
          )}
          {streaming != null && (
            streaming ? (
              <div className="max-w-[90%] self-start rounded-2xl bg-zinc-100 px-3 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><Markdown>{stripDeckAssignStreaming(streaming)}</Markdown></div>
            ) : thinking ? (
              <div className="max-w-[90%] self-start rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-800/50">
                <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#3B34E2] dark:text-[#8b86f5]">
                  <IconSparkles size={13} stroke={2} className={reduced ? undefined : "animate-pulse"} aria-hidden /> {t("mem.agentThinking")}
                </span>
                <p className="max-h-24 overflow-hidden whitespace-pre-wrap text-[11px] italic leading-snug text-zinc-400 dark:text-zinc-500">{thinking.length > 400 ? `…${thinking.slice(-400)}` : thinking}</p>
              </div>
            ) : (
              <div className="max-w-[90%] self-start rounded-2xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800"><span className="text-zinc-400 dark:text-zinc-500">{t("chat.replying")}</span></div>
            )
          )}
        </div>
        <div className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            disabled={loading || messages.length === 0}
            rows={1}
            placeholder={messages.length === 0 ? t("mem.assignChatDisabled") : t("mem.assignPlaceholder")}
            className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-[#3B34E2] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button type="button" onClick={() => { void send(); }} disabled={loading || messages.length === 0 || !input.trim()}
            className="shrink-0 rounded-xl bg-[#3B34E2] p-2.5 text-white transition hover:bg-[#322bc9] disabled:cursor-not-allowed disabled:opacity-40" aria-label={t("chat.send")}>
            <IconSend2 size={16} stroke={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* 추가 완료 팝업 — 덱별 합계. 닫으면 모달 종료. */}
      {result && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl dark:border-zinc-800 dark:bg-[#15161d]">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-lime-500/15 text-lime-600 dark:text-lime-400">
              <IconCheck size={22} stroke={2.5} aria-hidden />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t("mem.assignDoneTitle")}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t("mem.assignDoneMsg").replace("{decks}", String(result.decks)).replace("{n}", String(result.added))}
              {result.skipped > 0 && <> {t("mem.addSkippedMsg").replace("{n}", String(result.skipped))}</>}
            </p>
            <button type="button" onClick={() => { setResult(null); onApplied(); }}
              className="mt-4 w-full rounded-lg bg-[#3B34E2] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#322bc9]">
              {t("confirm.ok")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
