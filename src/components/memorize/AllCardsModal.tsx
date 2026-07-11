"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX, IconSearch, IconTrash, IconCheck, IconSquareCheck, IconSparkles, IconHandFinger, IconCirclePlus } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { collectCards } from "@/lib/srs/collect";
import { cardCategory, type CardCategory } from "@/lib/srs/due";
import { deleteCard } from "@/lib/srs/deleteCard";
import { addCustomDeck, addCardsToDeck, loadCustomDecks, removeCustomDeck, CUSTOM_DECKS_CHANGED_EVENT, type CustomDeck } from "@/lib/srs/customDeck";
import { DECK_SOURCES, type Card, type SrsSource } from "@/lib/srs/types";
import { CARDS_CHANGED_EVENT } from "@/lib/chatCard";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";
import { useFlyCard } from "./FlyCard";
import AgentDeckModal from "./AgentDeckModal";

const SYMBOL = "/brand/nunopi-symbol-darkeye-transparent.png";

type SourceFilter = "all" | SrsSource;
type CatFilter = "all" | CardCategory;
type Sort = "recent" | "oldest" | "most" | "least";

const SOURCE_CHIPS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "mem.catAll" },
  { key: "token", label: "mem.srcToken" },
  { key: "concept", label: "mem.srcConceptFull" },
  { key: "term", label: "mem.srcTerm" },
];

const CAT_CHIPS: { key: CatFilter; label: string; dot: string }[] = [
  { key: "all", label: "mem.catAll", dot: "bg-zinc-400" },
  { key: "again", label: "mem.again", dot: "bg-rose-500" },
  { key: "hard", label: "mem.hard", dot: "bg-amber-500" },
  { key: "good", label: "mem.good", dot: "bg-emerald-500" },
  { key: "none", label: "mem.catNone", dot: "bg-zinc-300 dark:bg-zinc-600" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "recent", label: "mem.sortRecent" },
  { key: "oldest", label: "mem.sortOldest" },
  { key: "most", label: "mem.sortMostReviewed" },
  { key: "least", label: "mem.sortLeastReviewed" },
];

const CAT_DOT: Record<CardCategory, string> = {
  again: "bg-rose-500",
  hard: "bg-amber-500",
  good: "bg-emerald-500",
  none: "bg-zinc-300 dark:bg-zinc-600",
};

// 전체 보유 카드 갤러리 — 검색·출처/분류 필터·정렬. 타일 클릭 시 카드가 날아온다(peek 재사용).
export default function AllCardsModal({ now, active = true, autoThrowCardKey, providerId, providerSettings, onClose }: { now: Date; active?: boolean; autoThrowCardKey?: string; providerId: AgentProviderKind; providerSettings: ProviderSettings; onClose: () => void }) {
  const t = useT();
  const confirm = useConfirm();
  const { throwCard } = useFlyCard();
  const [q, setQ] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [cat, setCat] = useState<CatFilter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  // 선택 삭제 모드 — 켜면 타일 클릭이 throw 대신 선택 토글.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 커스터마이징 — "choose"(수동/에이전트 선택) → "manual"(제목+카드선택). 에이전트는 이슈2.
  const [customize, setCustomize] = useState<null | "choose" | "manual" | "agent">(null);
  const [deckName, setDeckName] = useState("");
  // 선택 모드에서 카드를 넣을 대상 덱(삭제/덱추가 액션을 한 선택에서 함께 제공).
  const [addTarget, setAddTarget] = useState<string | null>(null);
  // 추가 완료 팝업 — 대상 덱명 + 추가/중복 개수.
  const [addResult, setAddResult] = useState<{ deckName: string; added: number; skipped: number } | null>(null);
  const picking = selectMode || customize === "manual"; // 타일 선택 가능(선택 모드/수동 덱 생성)
  // 내 덱 필터 — 선택 시 그 덱 카드만(출처/분류와 AND). 커스텀 덱 목록은 이벤트로 갱신.
  const [deckFilter, setDeckFilter] = useState<string | null>(null); // customDeck id
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>([]);
  useEffect(() => {
    const load = () => setCustomDecks(loadCustomDecks());
    load();
    window.addEventListener(CUSTOM_DECKS_CHANGED_EVENT, load);
    return () => window.removeEventListener(CUSTOM_DECKS_CHANGED_EVENT, load);
  }, []);
  // 필터 걸린 덱이 삭제되면 필터 해제(빈 그리드 방지).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (deckFilter && !customDecks.some((d) => d.id === deckFilter)) setDeckFilter(null);
  }, [customDecks, deckFilter]);
  // 추가 대상 덱이 삭제되면 대상 해제(추가 버튼 비활성).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (addTarget && !customDecks.some((d) => d.id === addTarget)) setAddTarget(customDecks[0]?.id ?? null);
  }, [customDecks, addTarget]);

  // 카드 생성(챗 등)되면 재수집 — 갤러리 열려 있는 동안 즉시 반영(안 그러면 다시 열어야 보임).
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const onChange = () => setNonce((n) => n + 1);
    window.addEventListener(CARDS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CARDS_CHANGED_EVENT, onChange);
  }, []);
  // nonce는 localStorage 재수집 트리거(collectCards는 순수하지 않음) — 의도된 deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => collectCards(DECK_SOURCES.all, now), [now, nonce]);

  // 출처로 이동(카드발) — 갤러리 열면서 생성처 카드를 바로 띄운다(peek). 마운트 시 1회.
  const threw = useRef(false);
  useEffect(() => {
    if (threw.current || !autoThrowCardKey) return;
    threw.current = true;
    const origin = all.find((c) => c.key === autoThrowCardKey);
    if (origin) throwCard(origin);
  }, [autoThrowCardKey, all, throwCard]);

  const cards = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all;
    if (deckFilter) {
      const keys = new Set(customDecks.find((d) => d.id === deckFilter)?.cardKeys ?? []);
      list = list.filter((c) => keys.has(c.key));
    }
    if (needle) list = list.filter((c) => c.front.toLowerCase().includes(needle));
    if (source !== "all") list = list.filter((c) => c.source === source);
    if (cat !== "all") list = list.filter((c) => cardCategory(c) === cat);
    const arr = [...list];
    arr.sort((a, b) => {
      if (sort === "most" || sort === "least") {
        const d = (b.state.reviews ?? 0) - (a.state.reviews ?? 0);
        return sort === "most" ? d : -d;
      }
      const cmp = (a.bookmarkedAt ?? "").localeCompare(b.bookmarkedAt ?? "");
      return sort === "recent" ? -cmp : cmp; // recent=최신 먼저
    });
    return arr;
  }, [all, q, source, cat, sort, deckFilter, customDecks]);

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function exitAll() {
    setSelectMode(false);
    setCustomize(null);
    setSelected(new Set());
    setDeckName("");
    setAddTarget(null);
  }
  // 선택 카드를 대상 덱에 병합(중복 제외). 결과 팝업 표시 후 모드 종료.
  function addSelectedToDeck() {
    if (selected.size === 0 || !addTarget) return;
    const target = customDecks.find((d) => d.id === addTarget);
    const { added, skipped } = addCardsToDeck(addTarget, [...selected]);
    setAddResult({ deckName: target?.name ?? "", added, skipped });
    exitAll();
  }
  // 선택 카드로 커스텀 덱 생성 → DeckSelect "내 덱"에 등장(CUSTOM_DECKS_CHANGED_EVENT).
  function createDeck() {
    if (selected.size === 0) return;
    addCustomDeck(deckName, [...selected]);
    exitAll();
  }
  async function deleteDeck(d: CustomDeck) {
    const ok = await confirm({ title: t("mem.deleteDeckTitle"), message: t("mem.deleteDeckMsg").replace("{name}", d.name), confirmText: t("common.delete"), danger: true });
    if (ok) removeCustomDeck(d.id);
  }
  async function deleteSelected() {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: t("mem.deleteCardTitle"),
      message: t("mem.deleteCardMsgN").replace("{n}", String(selected.size)),
      confirmText: t("common.delete"),
      danger: true,
    });
    if (!ok) return;
    all.filter((c) => selected.has(c.key)).forEach(deleteCard); // CARDS_CHANGED_EVENT → nonce 재수집
    exitAll();
  }

  return createPortal(
    <div className={`fixed inset-x-0 bottom-0 top-14 z-[60] flex-col bg-zinc-50/95 backdrop-blur-sm dark:bg-[#0b0c10]/95 ${active ? "flex" : "hidden"}`}>
      {/* 헤더 — 제목 + 검색 + 닫기 */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h2 className="shrink-0 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {t("mem.allCardsTitle")} <span className="text-zinc-400 dark:text-zinc-500">{cards.length}</span>
        </h2>
        <div className="relative ml-2 max-w-xs flex-1">
          <IconSearch size={15} stroke={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("mem.searchCards")}
            className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-[#3B34E2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </div>
        {/* 뷰 컨트롤 — 정렬(검색창 오른쪽). 모든 모드에서 노출. */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {SORTS.map((s) => <option key={s.key} value={s.key}>{t(s.label)}</option>)}
        </select>
        <div className="flex-1" />
        {selectMode ? (
          <>
            {/* 덱에 추가 — 커스텀 덱 있을 때. 대상 select + 추가 버튼 */}
            {customDecks.length > 0 && (
              <>
                <select
                  value={addTarget ?? ""}
                  onChange={(e) => setAddTarget(e.target.value || null)}
                  className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-[#3B34E2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  {customDecks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={addSelectedToDeck}
                  disabled={selected.size === 0 || !addTarget}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#3B34E2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <IconCirclePlus size={15} stroke={2} aria-hidden />
                  {t("mem.addToDeckN").replace("{n}", String(selected.size))}
                </button>
                <span className="h-5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
              </>
            )}
            {/* 삭제 */}
            <button
              type="button"
              onClick={() => { void deleteSelected(); }}
              disabled={selected.size === 0}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconTrash size={15} stroke={2} aria-hidden />
              {t("mem.deleteN").replace("{n}", String(selected.size))}
            </button>
            <button type="button" onClick={exitAll} className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              {t("confirm.cancel")}
            </button>
          </>
        ) : customize === "manual" ? (
          <>
            <input
              autoFocus
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createDeck(); }}
              placeholder={t("mem.deckNamePlaceholder")}
              className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-[#3B34E2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <button
              type="button"
              onClick={createDeck}
              disabled={selected.size === 0}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#3B34E2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconSparkles size={15} stroke={2} aria-hidden />
              {t("mem.makeDeckN").replace("{n}", String(selected.size))}
            </button>
            <button type="button" onClick={exitAll} className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              {t("confirm.cancel")}
            </button>
          </>
        ) : (
          <>
            {/* 카드 관리: 선택(삭제·덱추가 통합) */}
            <button
              type="button"
              onClick={() => { setSelectMode(true); setSelected(new Set()); setAddTarget(deckFilter ?? customDecks[0]?.id ?? null); setAddResult(null); }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <IconSquareCheck size={15} stroke={2} aria-hidden />
              {t("mem.select")}
            </button>
            <span className="h-5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
            {/* 덱 만들기 */}
            <button
              type="button"
              onClick={() => setCustomize("choose")}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#3B34E2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9]"
            >
              <IconSparkles size={15} stroke={2} aria-hidden />
              {t("mem.customize")}
            </button>
            <span className="h-5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
            {/* 닫기 */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("mem.exit")}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <IconX size={15} stroke={2} aria-hidden />
              {t("mem.exit")}
            </button>
          </>
        )}
      </div>

      {/* 필터 칩 — 출처 + 분류 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_CHIPS.map((c) => (
            <Chip key={c.key} on={source === c.key} onClick={() => setSource(c.key)} label={t(c.label)} />
          ))}
        </div>
        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex flex-wrap gap-1.5">
          {CAT_CHIPS.map((c) => (
            <Chip key={c.key} on={cat === c.key} onClick={() => setCat(c.key)} label={t(c.label)} dot={c.dot} />
          ))}
        </div>
        {/* 내 덱 필터 — 선택 시 그 덱 카드만(출처/분류와 AND). 다시 누르면 해제. */}
        {customDecks.length > 0 && (
          <>
            <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{t("mem.customDecks")}</span>
            <div className="flex flex-wrap gap-1.5">
              {customDecks.map((d) => {
                const on = deckFilter === d.id;
                return (
                  <span
                    key={d.id}
                    className={`group inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-xs font-medium transition ${
                      on ? "bg-[#3B34E2] text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <button type="button" onClick={() => setDeckFilter((cur) => (cur === d.id ? null : d.id))} className="whitespace-nowrap">
                      {d.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => { void deleteDeck(d); }}
                      aria-label={t("mem.deleteDeckTitle")}
                      className={`rounded-full p-0.5 transition ${on ? "hover:bg-white/20" : "text-zinc-400 hover:text-rose-500 dark:text-zinc-500"}`}
                    >
                      <IconX size={12} stroke={2.5} aria-hidden />
                    </button>
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 카드 격자 */}
      <div className="nunopi-scroll flex-1 overflow-y-auto px-6 py-5">
        {cards.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400 dark:text-zinc-600">
            {t("mem.noCardsFound")}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))" }}>
            {cards.map((c) => (
              <CardTile
                key={c.key}
                card={c}
                reviews={c.state.reviews ?? 0}
                picking={picking}
                selected={selected.has(c.key)}
                tone="indigo"
                onToggle={() => toggleSelect(c.key)}
                onThrow={throwCard}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* 커스터마이징 방식 선택 — 수동(직접 고르기) / 에이전트(이슈2, 곧). */}
      {customize === "choose" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-6" onClick={() => setCustomize(null)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#15161d]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-center text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t("mem.customizeTitle")}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setCustomize("manual"); setSelected(new Set()); setDeckName(""); }}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 p-4 text-center transition hover:border-[#3B34E2] hover:bg-[#3B34E2]/5 dark:border-zinc-700"
              >
                <IconHandFinger size={22} stroke={2} className="text-[#3B34E2] dark:text-[#8b86f5]" aria-hidden />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t("mem.customizeManual")}</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{t("mem.customizeManualDesc")}</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomize("agent")}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 p-4 text-center transition hover:border-[#3B34E2] hover:bg-[#3B34E2]/5 dark:border-zinc-700"
              >
                <IconSparkles size={22} stroke={2} className="text-[#3B34E2] dark:text-[#8b86f5]" aria-hidden />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t("mem.customizeAgent")}</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{t("mem.customizeAgentDesc")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 덱 추가 결과 팝업 — 추가/중복 개수 안내. */}
      {addResult && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-6" onClick={() => setAddResult(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl dark:border-zinc-800 dark:bg-[#15161d]" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#3B34E2]/10 text-[#3B34E2] dark:text-[#8b86f5]">
              {addResult.added > 0 ? <IconCheck size={22} stroke={2.5} aria-hidden /> : <IconCirclePlus size={22} stroke={2} aria-hidden />}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {addResult.added > 0 ? t("mem.addDoneTitle") : t("mem.addNoneTitle")}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {addResult.added > 0
                ? t("mem.addDoneMsg").replace("{n}", String(addResult.added)).replace("{deck}", addResult.deckName)
                : t("mem.addNoneMsg").replace("{deck}", addResult.deckName)}
              {addResult.added > 0 && addResult.skipped > 0 && (
                <> {t("mem.addSkippedMsg").replace("{n}", String(addResult.skipped))}</>
              )}
            </p>
            <button
              type="button"
              onClick={() => setAddResult(null)}
              className="mt-4 w-full rounded-lg bg-[#3B34E2] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#322bc9]"
            >
              {t("confirm.ok")}
            </button>
          </div>
        </div>
      )}

      {/* 에이전트 덱 커스터마이징 — 목표 프롬프트로 자동 선별. 생성 시 나가기(내 덱에 등장). */}
      {customize === "agent" && (
        <AgentDeckModal
          now={now}
          providerId={providerId}
          providerSettings={providerSettings}
          onBack={() => setCustomize(null)}
          onCreated={() => { setCustomize(null); }}
        />
      )}
    </div>,
    document.body,
  );
}

function Chip({ on, onClick, label, dot }: { on: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
        on ? "bg-[#3B34E2] text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
    </button>
  );
}

// 게임 카드팩 느낌의 미니 타일 — 흰 포커카드 + 용어 + 출처 배지 + 분류 점 + 복습 수.
function CardTile({ card, reviews, picking, selected, tone, onToggle, onThrow, t }: { card: Card; reviews: number; picking: boolean; selected: boolean; tone: "rose" | "indigo"; onToggle: () => void; onThrow: (c: Card, r?: DOMRect) => void; t: (k: string) => string }) {
  const SRC_LABEL: Record<Card["source"], string> = { token: "mem.srcToken", concept: "mem.srcConcept", term: "mem.srcTerm" };
  const ring = tone === "rose" ? "border-rose-500 ring-2 ring-rose-500" : "border-[#3B34E2] ring-2 ring-[#3B34E2]";
  const badge = tone === "rose" ? "border-rose-500 bg-rose-500 text-white" : "border-[#3B34E2] bg-[#3B34E2] text-white";
  return (
    <button
      type="button"
      onClick={(e) => (picking ? onToggle() : onThrow(card, e.currentTarget.getBoundingClientRect()))}
      className={`group relative flex aspect-[5/7] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border bg-white p-3 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-zinc-700 ${
        picking && selected ? ring : "border-zinc-200"
      }`}
    >
      <span className="pointer-events-none absolute inset-[6%] rounded-[10%] border-2 border-blue-500/50" />
      <span className="pointer-events-none absolute inset-[9%] rounded-[8%] border border-blue-500/30" />
      {/* 선택(삭제/덱만들기) 모드 체크 표시 */}
      {picking && (
        <span className={`absolute right-2 bottom-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border ${selected ? badge : "border-zinc-300 bg-white/70 dark:border-zinc-600 dark:bg-zinc-800/70"}`}>
          {selected && <IconCheck size={12} stroke={3} aria-hidden />}
        </span>
      )}
      {/* 상단 배지 — 출처 + 분류 점 */}
      <span className="absolute left-2 top-2 flex items-center gap-1">
        <span className={`h-2 w-2 rounded-full ${CAT_DOT[cardCategory(card)]}`} />
      </span>
      <span className="absolute right-2 top-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[8px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {t(SRC_LABEL[card.source])}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SYMBOL} alt="" className="relative mt-2 h-6 w-6 object-contain" />
      <span className="relative line-clamp-3 text-xs font-bold leading-tight text-zinc-900">{card.front}</span>
      <span className="absolute bottom-2 text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
        {t("mem.reviewsShort").replace("{n}", String(reviews))}
      </span>
    </button>
  );
}
