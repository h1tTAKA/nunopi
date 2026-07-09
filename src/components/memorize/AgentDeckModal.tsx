"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconSparkles, IconX, IconSend2 } from "@tabler/icons-react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { collectCards } from "@/lib/srs/collect";
import { addCustomDeck } from "@/lib/srs/customDeck";
import { buildDeckSelectContext, parseDeckSelect, stripDeckSelect, stripDeckSelectStreaming } from "@/lib/deckSelect";
import { DECK_SOURCES, type Card } from "@/lib/srs/types";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";

const SYMBOL = "/brand/nunopi-symbol-darkeye-transparent.png";
type StreamEvent = { type: "progress"; line: string } | { type: "result"; response: { summary: string } } | { type: "error"; message: string };

// 에이전트 덱 커스터마이징 — 대화형. 상담(덱 나누는 법 제안)도 하고, 특정 덱을 만들자 하면
// 에이전트가 카드 key를 골라(chat 재사용) 좌측에 stagger 리빌 → 제외 → 수락 시 커스텀 덱 생성.
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
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const all = useMemo(() => collectCards(DECK_SOURCES.all, now), [now]);
  const byKey = useMemo(() => new Map(all.map((c) => [c.key, c])), [all]);
  const context = useMemo(() => buildDeckSelectContext(all), [all]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null); // 실시간 타이핑 텍스트
  const [selected, setSelected] = useState<Card[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [reveal, setReveal] = useState(0);
  const [deckName, setDeckName] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  // 대화/로딩 갱신 시 맨 아래로.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, loading, streaming]);

  // 선별 결과가 바뀌면 stagger 리빌(애니 카운터라 effect 내 setState 의도적).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (selected.length === 0) { setReveal(0); return; }
    if (reduced) { setReveal(selected.length); return; }
    setReveal(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setReveal(i);
      if (i >= selected.length) window.clearInterval(id);
    }, 110);
    return () => window.clearInterval(id);
  }, [selected, reduced]);
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
      // 덱 선별 블록이 있으면 좌측 리빌. 본문(블록 제거)만 대화에 표시.
      const keys = parseDeckSelect(reply);
      if (keys.length > 0) {
        const cards = keys.map((k) => byKey.get(k)).filter((c): c is Card => !!c);
        setSelected(cards);
        setExcluded(new Set());
      }
      setMessages([...thread, { role: "assistant", content: stripDeckSelect(reply) || t("mem.agentDeckNone") }]);
    } catch {
      if (!ac.signal.aborted) setMessages([...thread, { role: "assistant", content: t("mem.agentDeckNone") }]);
    } finally {
      if (!ac.signal.aborted) { setLoading(false); setStreaming(null); }
    }
  }

  function toggleExclude(key: string) {
    setExcluded((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  const finalCards = selected.filter((c) => !excluded.has(c.key));
  function create() {
    if (finalCards.length === 0) return;
    addCustomDeck(deckName || t("mem.agentDeckTitle"), finalCards.map((c) => c.key), messages.find((m) => m.role === "user")?.content);
    onCreated();
  }

  return (
    <div className="absolute inset-0 z-10 flex bg-black/50 backdrop-blur-sm">
      {/* 좌: 선별 카드 프리뷰(stagger) */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-zinc-200 bg-zinc-50/95 dark:border-zinc-800 dark:bg-[#0b0c10]/95">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t("mem.agentDeckSelected")}</span>
          {finalCards.length > 0 && <span className="text-xs text-zinc-400 dark:text-zinc-500">{finalCards.length}</span>}
        </div>
        <div className="nunopi-scroll flex-1 overflow-y-auto p-5">
          {selected.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
              {t("mem.agentDeckEmpty")}
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))" }}>
              {selected.slice(0, reveal).map((c) => {
                const ex = excluded.has(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleExclude(c.key)}
                    className={`relative flex aspect-[5/7] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border bg-white p-2.5 text-center shadow-sm transition hover:-translate-y-0.5 ${
                      ex ? "border-zinc-300 dark:border-zinc-600" : "border-[#3B34E2]/50"
                    }`}
                    style={reduced ? undefined : { animation: "nunopi-pop 260ms ease-out both" }}
                  >
                    <span className="pointer-events-none absolute inset-[6%] rounded-[10%] border-2 border-blue-500/55" />
                    <span className="pointer-events-none absolute inset-[9%] rounded-[8%] border border-blue-500/30" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SYMBOL} alt="" className="relative h-5 w-5 object-contain" />
                    <span className="relative line-clamp-3 text-[11px] font-bold leading-tight text-zinc-900">{c.front}</span>
                    {ex && (
                      <span className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/65">
                        <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white shadow">{t("mem.excludeBadge")}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 우: 대화형 프롬프트 */}
      <div className="flex w-80 shrink-0 flex-col bg-white dark:bg-[#15161d]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
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
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "max-w-[90%] self-end whitespace-pre-wrap rounded-2xl bg-blue-500 px-3 py-2 text-white" : "max-w-[90%] self-start whitespace-pre-wrap rounded-2xl bg-zinc-100 px-3 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}>
              {m.content}
            </div>
          ))}
          {streaming != null && (
            <div className="max-w-[90%] self-start whitespace-pre-wrap rounded-2xl bg-zinc-100 px-3 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {streaming ? stripDeckSelectStreaming(streaming) : <span className="text-zinc-400 dark:text-zinc-500">{t("chat.replying")}</span>}
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
        {/* 수락 — 선별 결과 있을 때 */}
        {selected.length > 0 && (
          <div className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <input
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder={t("mem.deckNamePlaceholder")}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-[#3B34E2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <button
              type="button"
              onClick={create}
              disabled={finalCards.length === 0}
              className="shrink-0 rounded-lg bg-[#3B34E2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9] disabled:opacity-40"
            >
              {t("mem.agentDeckAccept")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
