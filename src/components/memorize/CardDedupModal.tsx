"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconX, IconSparkles, IconEye, IconTrash, IconCircleCheck } from "@tabler/icons-react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { collectCards } from "@/lib/srs/collect";
import { deleteCard } from "@/lib/srs/deleteCard";
import { DECK_SOURCES, type Card } from "@/lib/srs/types";
import { cardFrame } from "@/lib/srs/cardFrame";
import { buildDedupContext, parseDedupGroups } from "@/lib/cardDedup";
import { normalizeCardFront } from "@/lib/bookmarkDetails";
import { useFlyCard } from "./FlyCard";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";

const SYMBOL = "/brand/nunopi-symbol-darkeye-transparent.png";
type StreamEvent =
  | { type: "progress"; line: string }
  | { type: "thinking"; line: string }
  | { type: "result"; response: { summary: string } }
  | { type: "error"; message: string };

// 에이전트가 찾은 중복 묶음(카드 해석 완료) — 카드 2장 이상.
interface ResolvedGroup {
  id: string;
  cards: Card[];
  reason: string;
}

let groupIdSeq = 0;
function newGroupId(): string {
  try { return crypto.randomUUID(); } catch { groupIdSeq += 1; return `dg-${groupIdSeq}`; }
}

// 이름(앞면) 정규화가 겹치는 카드가 있으면 '이름 중복' 묶음 — 표기만 다른 확실한 중복이라 최우선.
function isNameDup(g: ResolvedGroup): boolean {
  const seen = new Set<string>();
  for (const c of g.cards) {
    const n = normalizeCardFront(c.front);
    if (seen.has(n)) return true;
    seen.add(n);
  }
  return false;
}

// 갤러리 카드 중복 정리 — 마운트 즉시 에이전트가 의미 중복을 탐색(chat 재사용),
// 결과 묶음을 보여주고 유저가 지울 카드를 골라 삭제. 둘 다 유지도 가능.
export default function CardDedupModal({
  now, providerId, providerSettings, onClose,
}: {
  now: Date;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
  onClose: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const confirm = useConfirm();
  const toast = useToast();
  const { throwCard } = useFlyCard();
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState(0); // 탐색 진행률(추정) — 단일 LLM 호출이라 실제 %가 없어 시간 기반으로 부드럽게 채운다.
  const [thinking, setThinking] = useState("");
  const [groups, setGroups] = useState<ResolvedGroup[]>([]);
  // 지울 카드 key 집합(전 그룹 통합). 기본은 전부 유지(빈 집합).
  const [toDelete, setToDelete] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const [scanNonce, setScanNonce] = useState(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  // 진행률(추정) — 탐색 중 92%까지 점근적으로 차오르고, 완료 시 아래 스캔 effect가 100%로 마무리.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loading) return;
    setPct(6);
    const id = window.setInterval(() => setPct((p) => (p >= 92 ? p : p + (92 - p) * 0.07)), 220);
    return () => window.clearInterval(id);
  }, [loading, scanNonce]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 탐색 실행 — 마운트 시 1회, "다시 탐색" 시 재실행.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    const all = collectCards(DECK_SOURCES.all, now);
    const byKey = new Map(all.map((c) => [c.key, c]));
    setLoading(true);
    setThinking("");
    setGroups([]);
    setToDelete(new Set());
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      // 카드가 2장 미만이면 중복이 있을 수 없다 — 호출 생략.
      if (all.length < 2) {
        if (!cancelled) setLoading(false);
        return;
      }
      const thread: ChatMessage[] = [{ role: "user", content: t("mem.dedup") }];
      try {
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            request: { code: buildDedupContext(all), locale, providerId, mode: "chat", messages: thread, providerSettings },
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
                if (ev.type === "thinking") { if (!cancelled) setThinking(ev.line); }
                else if (ev.type === "result") answer = ev.response.summary;
              } catch { /* skip */ }
            }
          }
          if (buffer.trim()) { try { const ev = JSON.parse(buffer) as StreamEvent; if (ev.type === "result") answer = ev.response.summary; } catch { /* skip */ } }
        }
        if (cancelled || ac.signal.aborted) return;
        // key → 카드 해석. 실재하는 카드 2장 이상인 그룹만.
        const built: ResolvedGroup[] = parseDedupGroups(answer)
          .map((g) => ({
            id: newGroupId(),
            reason: g.reason,
            cards: [...new Set(g.keys)].map((k) => byKey.get(k)).filter((c): c is Card => !!c),
          }))
          .filter((g) => g.cards.length >= 2);
        // 이름(표기) 중복을 최상단으로 — 정규화 앞면이 겹치는 확실한 중복 먼저 처리하게(안정 정렬).
        built.sort((a, b) => Number(isNameDup(b)) - Number(isNameDup(a)));
        setPct(100);
        setGroups(built);
      } catch {
        // abort는 조용히, 그 외엔 빈 결과(없음 메시지).
      } finally {
        if (!cancelled && !ac.signal.aborted) { setLoading(false); setThinking(""); }
      }
    })();

    return () => { cancelled = true; ac.abort(); };
    // now/locale/providerId/providerSettings는 모달 수명 동안 고정. scanNonce로만 재탐색.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanNonce]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleDelete(key: string) {
    setToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function deleteSelected() {
    if (toDelete.size === 0) return;
    const n = toDelete.size;
    const ok = await confirm({
      title: t("mem.dedupDeleteTitle"),
      message: t("mem.dedupDeleteMsg").replace("{n}", String(n)),
      danger: true,
    });
    if (!ok) return;
    // 삭제 대상 카드 수집 후 삭제.
    const victims = groups.flatMap((g) => g.cards).filter((c) => toDelete.has(c.key));
    for (const c of victims) deleteCard(c);
    // 남은 그룹에서 삭제 카드 제거 → 카드 2장 미만 그룹은 정리 완료로 간주해 제거.
    const remaining = groups
      .map((g) => ({ ...g, cards: g.cards.filter((c) => !toDelete.has(c.key)) }))
      .filter((g) => g.cards.length >= 2);
    setGroups(remaining);
    setToDelete(new Set());
    toast(t("mem.dedupDone").replace("{n}", String(n)));
    if (remaining.length === 0) onClose();
  }

  const totalDupCards = useMemo(() => groups.reduce((n, g) => n + g.cards.length, 0), [groups]);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm" onClick={onClose}>
      {/* 중앙 모달 패널 — 적당한 크기(뷰포트에 맞춤). 바깥 클릭 시 닫기, 안쪽은 전파 차단. */}
      <div
        className="flex max-h-[82vh] w-[min(92vw,760px)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0b0c10]"
        onClick={(e) => e.stopPropagation()}
      >
      {/* 헤더 */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <IconSparkles size={15} stroke={2} className="text-amber-500" aria-hidden /> {t("mem.dedupTitle")}
        </span>
        {!loading && groups.length > 0 && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{groups.length}</span>
        )}
        {!loading && (
          <button
            type="button"
            onClick={() => setScanNonce((n) => n + 1)}
            className="ml-auto shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("mem.dedupRescan")}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("mem.close")}
          className={`shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-200 dark:hover:bg-zinc-800 ${loading ? "ml-auto" : ""}`}
        >
          <IconX size={16} stroke={2} aria-hidden />
        </button>
      </div>

      {loading ? (
        // 중앙 로딩 — 진행률(추정) 막대 + 안내 + 실시간 추론(있으면).
        <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
          <IconSparkles size={30} stroke={1.6} className={`text-amber-500 ${reduced ? "" : "animate-pulse"}`} aria-hidden />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{t("mem.dedupScanning")}</p>
          <div className="w-full max-w-xs">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-amber-500 transition-[width] duration-300 ease-out" style={{ width: `${Math.round(pct)}%` }} />
            </div>
            <p className="mt-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">{Math.round(pct)}%</p>
          </div>
          {thinking && (
            <p className="max-h-24 max-w-md overflow-hidden whitespace-pre-wrap text-[11px] italic leading-snug text-zinc-400 dark:text-zinc-500">
              {thinking.length > 400 ? `…${thinking.slice(-400)}` : thinking}
            </p>
          )}
        </div>
      ) : groups.length === 0 ? (
        // 중복 없음.
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
          <IconCircleCheck size={30} stroke={1.6} className="text-emerald-500" aria-hidden />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("mem.dedupNone")}</p>
        </div>
      ) : (
        <>
          <div className="nunopi-scroll flex-1 overflow-y-auto p-5">
            <p className="mb-4 text-xs text-zinc-400 dark:text-zinc-500">{t("mem.dedupHint")}</p>
            <div className="flex flex-col gap-6">
              {groups.map((g) => (
                <section key={g.id} className="flex flex-col gap-2.5">
                  {g.reason && (
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{g.reason}</p>
                  )}
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))" }}>
                    {g.cards.map((c) => {
                      const del = toDelete.has(c.key);
                      return (
                        <div
                          key={c.key}
                          data-fly-card
                          className={`group relative aspect-[5/7] overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 ${
                            del ? "border-rose-400" : "border-[#3B34E2]/50"
                          }`}
                        >
                          <span className={`pointer-events-none absolute inset-[6%] rounded-[10%] border-2 ${cardFrame(c.source).outer}`} />
                          <span className={`pointer-events-none absolute inset-[9%] rounded-[8%] border ${cardFrame(c.source).inner}`} />
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2.5 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={SYMBOL} alt="" className="h-5 w-5 object-contain" />
                            <span className="line-clamp-3 text-[11px] font-bold leading-tight text-zinc-900">{c.front}</span>
                          </div>
                          {/* 카드 클릭 = 삭제 대상 토글 */}
                          <button
                            type="button"
                            aria-label={c.front}
                            aria-pressed={del}
                            onClick={() => toggleDelete(c.key)}
                            className="absolute inset-0 z-10 cursor-pointer rounded-2xl"
                          />
                          {/* 삭제 대상이면 붉은 뮤트 */}
                          {del && <span className="pointer-events-none absolute inset-0 z-20 rounded-2xl bg-rose-900/40" />}
                          {/* 우상단 상태 배지 — 유지/삭제 */}
                          <span className={`pointer-events-none absolute right-1.5 top-1.5 z-30 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            del ? "bg-rose-500 text-white" : "bg-white/85 text-zinc-500"
                          }`}>
                            {del ? t("mem.dedupDeleteBadge") : t("mem.dedupKeepBadge")}
                          </span>
                          {/* 호버 시 상세 보기(카드 날리기) */}
                          <button
                            type="button"
                            onClick={(e) => throwCard(c, (e.currentTarget.closest("[data-fly-card]") as HTMLElement | null)?.getBoundingClientRect())}
                            className="absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-lg bg-zinc-700/90 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-md transition hover:bg-zinc-800 group-hover:opacity-100"
                          >
                            <IconEye size={13} stroke={2} aria-hidden />
                            {t("mem.cardDetail")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
          {/* 하단 — 선택 삭제 */}
          <div className="flex shrink-0 items-center gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{groups.length} · {totalDupCards}</span>
            <button
              type="button"
              onClick={() => { void deleteSelected(); }}
              disabled={toDelete.size === 0}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconTrash size={15} stroke={2} aria-hidden />
              {t("mem.dedupDeleteN").replace("{n}", String(toDelete.size))}
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
