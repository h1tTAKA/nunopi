"use client";
// 캐치업(#992, 구 학습 스트림 #855·#857) — MCP 연결 에이전트가 뭘 하든(그래프 탐색+파일 편집) 실시간 관찰(SSE) +
// 등장한 "개념"을 중복 없이 1회씩 설명하고, 이해에 필요한 "용어"를 별도 용어집으로 누적. 반복 없이 정리.
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { IconCode, IconFile, IconSearch, IconSitemap, IconActivity, IconPointFilled, IconLoader2, IconPencil, IconChevronDown, IconBook2, IconBroadcast, IconCalendar, IconArrowBarToUp } from "@tabler/icons-react";
import CatchupCalendar from "@/components/workspace/CatchupCalendar";
import { useT, useLocale } from "@mustard/core";
import type { AgentProviderKind, ProviderSettings } from "@mustard/core";
import { Markdown } from "@mustard/core";
import { stripCardBlock } from "@mustard/core";
type ConceptKind = "symbol" | "file" | "query" | "repo" | "edit" | "narration";
interface ActivityEvent { root: string; tool: string; kind: ConceptKind; target: string; isError: boolean; ts: number; note?: string }
interface Concept { key: string; kind: ConceptKind; target: string; tool: string; status: "idle" | "loading" | "done" | "error"; expl?: string; ts: number }
interface Term { term: string; def: string }
type StreamEvent = { type: string; message?: string; response?: { summary?: string } };

const KIND_ICON: Record<ConceptKind, typeof IconCode> = { symbol: IconCode, file: IconFile, query: IconSearch, repo: IconSitemap, edit: IconPencil, narration: IconBroadcast };
const KIND_VERB: Record<ConceptKind, string> = { symbol: "심볼", file: "파일", query: "주제", repo: "레포 구조", edit: "편집 중인 파일", narration: "실시간" };
const basename = (p: string) => p.split("/").filter(Boolean).pop() ?? p;
const ago = (ts: number, now: number) => { const s = Math.max(0, Math.round((now - ts) / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`; };
// 생성 시점 "MM-DD HH:MM" — 구분선이 있어도 카드 단독으로 날짜가 보이게(유저 요청, #994).
const fmtDateTime = (ts: number) => { const d = new Date(ts); const p = (n: number) => String(n).padStart(2, "0"); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
// 로컬 날짜 키(서버 파일명과 같은 규칙) — 구분선 그룹 기준.
const dayOf = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// 카톡式 구분선 표기 — locale별 자동(ko "2026년 10월 6일 화요일", ja "2026年10月6日火曜日", en "Tuesday, October 6, 2026").
const fmtDay = (ts: number, locale: string) => { try { return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(ts); } catch { return new Date(ts).toDateString(); } };
const MAX_ITEMS = 200; // #994 화면 메모리 상한(서버 로드 100 + 실시간 여유). 전체 기록은 서버 날짜별 파일.
const cKey = (root: string) => `nunopi:ws:${root}:learn-concepts`; // #994 이전 저장소(1회 이관 후 삭제)
const gKey = (root: string) => `nunopi:ws:${root}:learn-terms`;
function load<T>(key: string): T[] { try { const r = typeof localStorage !== "undefined" && localStorage.getItem(key); return r ? (JSON.parse(r) as T[]) : []; } catch { return []; } }

// 개념 1개 설명 프롬프트 — 설명 2문장 + [용어] term :: 뜻. 카드·JSON·코드 금지.
function conceptPrompt(repo: string, kind: ConceptKind, target: string): string {
  return `레포 "${repo}"에서 AI 코딩 에이전트가 지금 ${KIND_VERB[kind]} "${target}"을(를) 다루고 있어.\n`
    + `이게 뭐고 에이전트가 왜 이걸 보는지 개발 초보에게 자연스러운 한국어 2문장으로.\n`
    + `그 다음 줄에 "[용어]"만 쓰고, 이 설명을 이해하는 데 필요한 핵심 용어 2~3개를 "용어 :: 한 줄 뜻" 형식으로 한 줄씩.\n`
    + `코드·카드·JSON·메타 발언 금지. 설명은 흐르는 문장으로(사전식 나열 말고).`;
}

// 응답 → {설명, 용어[]}. "[용어]" 기준 분리, 카드/펜스 제거.
function parseConcept(raw: string): { expl: string; terms: Term[] } {
  let s = stripCardBlock(raw);
  const cardCut = s.search(/```|nunopi-cards|(^|\n)\s*\[\s*\{\s*"(term|word|title)"/i);
  if (cardCut >= 0) s = s.slice(0, cardCut);
  // "[용어]" 마커(앞 개행 없어도) 기준 분리 — 앞=설명, 뒤=용어 목록.
  const m = s.split(/\[\s*용어\s*\]\s*/i);
  const expl = (m[0] ?? "").trim();
  const terms: Term[] = [];
  if (m[1]) for (const line of m.slice(1).join("\n").split("\n")) { // 용어는 한 줄에 하나(term :: 뜻)
    const t = line.replace(/^[-*•\s]+/, "").split(/\s*::\s*/);
    if (t.length >= 2 && t[0].trim() && t.slice(1).join("::").trim()) terms.push({ term: t[0].trim(), def: t.slice(1).join("::").trim() });
  }
  return { expl: expl || "—", terms };
}

// #994 서버 날짜별 저장 — 성공 여부 반환(이관 시 로컬 삭제 판단). 실패해도 화면 흐름은 안 막음.
async function saveItems(root: string, items: { key: string; kind: ConceptKind; target: string; tool: string; ts: number; expl: string }[]): Promise<boolean> {
  try {
    const r = await fetch("/api/repo/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ root, items }) });
    return r.ok && (await r.json())?.ok === true;
  } catch { return false; }
}

export default function RepoLearnStream({ root, providerId, providerSettings }: {
  root: string;
  providerId?: AgentProviderKind;
  providerSettings?: ProviderSettings;
}) {
  const t = useT();
  const { locale } = useLocale();
  // #994 기록은 서버 날짜별 저장소(~/.nunopi/stream)에서 — 마운트 시 최근 100개 로드(loaded 전엔 빈 안내 숨김).
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [terms, setTerms] = useState<Term[]>(() => load<Term>(gKey(root)));
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => 0);
  const [autoExplain, setAutoExplain] = useState(true);
  const [termsOpen, setTermsOpen] = useState(true);

  const seenRef = useRef(new Set<string>());                          // 이미 설명한 개념(dedup) — 서버 로드 시 채움
  const termSetRef = useRef(new Set(terms.map((x) => x.term.toLowerCase()))); // 용어 dedup
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const metaRef = useRef(new Map<string, { kind: ConceptKind; target: string; tool: string }>());
  const cfgRef = useRef({ providerId, providerSettings, locale, autoExplain });
  useEffect(() => { cfgRef.current = { providerId, providerSettings, locale, autoExplain }; }, [providerId, providerSettings, locale, autoExplain]);

  const explainOne = useCallback(async (key: string) => {
    const meta = metaRef.current.get(key); const { providerId: pid, providerSettings: ps, locale: loc } = cfgRef.current;
    if (!meta || !pid) return;
    setConcepts((p) => p.map((c) => (c.key === key ? { ...c, status: "loading" } : c)));
    try {
      const res = await fetch("/api/agent/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: pid, request: { code: `레포: ${basename(root)}`, locale: loc, providerId: pid, mode: "chat", messages: [{ role: "user", content: conceptPrompt(basename(root), meta.kind, meta.target) }], providerSettings: ps } }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader(); const dec = new TextDecoder();
      let buf = "", answer = "", streamErr = "";
      for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const ls = buf.split("\n"); buf = ls.pop() ?? ""; for (const l of ls) { if (!l.trim()) continue; let ev: StreamEvent; try { ev = JSON.parse(l) as StreamEvent; } catch { continue; } if (ev.type === "result") answer = ev.response?.summary ?? ""; else if (ev.type === "error") streamErr = ev.message ?? "error"; } }
      if (streamErr) throw new Error(streamErr);
      const { expl, terms: newTerms } = parseConcept(answer);
      setConcepts((p) => p.map((c) => (c.key === key ? { ...c, status: "done", expl } : c)));
      saveItems(root, [{ key, kind: meta.kind, target: meta.target, tool: meta.tool, ts: Date.now(), expl }]); // #994 날짜별 저장(내레이션은 서버가 직접)
      if (newTerms.length) setTerms((prev) => { const add = newTerms.filter((x) => { const lk = x.term.toLowerCase(); if (termSetRef.current.has(lk)) return false; termSetRef.current.add(lk); return true; }); return add.length ? [...add, ...prev].slice(0, 80) : prev; });
    } catch { setConcepts((p) => p.map((c) => (c.key === key ? { ...c, status: "error" } : c))); }
  }, [root]);

  const pump = useCallback(async () => {
    if (busyRef.current) return; busyRef.current = true;
    while (queueRef.current.length) { const key = queueRef.current.shift()!; await explainOne(key); }
    busyRef.current = false;
  }, [explainOne]);

  const enqueue = useCallback((key: string) => { if (seenRef.current.has(key)) return; seenRef.current.add(key); queueRef.current.push(key); void pump(); }, [pump]);

  // SSE — 이벤트 → 개념 upsert(중복은 ts/tool만 갱신) + 새 개념이면 설명 큐.
  useEffect(() => {
    if (!root) return;
    const es = new EventSource(`/api/repo/mcp/activity/stream?root=${encodeURIComponent(root)}`);
    es.onopen = () => setLive(true); es.onerror = () => setLive(false);
    es.onmessage = (m) => {
      let ev: ActivityEvent; try { ev = JSON.parse(m.data) as ActivityEvent; } catch { return; }
      if (!ev?.target) return;
      // #870 실시간 내레이션 — 서버가 이미 설명(note)을 생성해 실었으므로 클라 재분석 없이 done 카드로 바로.
      if (ev.kind === "narration") {
        if (!ev.note) return;
        const nkey = `narration|${ev.ts}|${ev.target}`;                 // ts+제목 = 고유 키(같은 ms 충돌 방지)
        setConcepts((prev) => (prev.some((c) => c.key === nkey) ? prev  // 이미 있으면 스킵(SSE 재연결 replay 중복 방지)
          : [{ key: nkey, kind: "narration" as const, target: ev.target, tool: "narration", status: "done" as const, ts: ev.ts, expl: ev.note }, ...prev].slice(0, MAX_ITEMS)));
        return;
      }
      const key = `${ev.kind}|${ev.target}`;
      metaRef.current.set(key, { kind: ev.kind, target: ev.target, tool: ev.tool });
      setConcepts((prev) => { const found = prev.find((c) => c.key === key); if (found) return [{ ...found, tool: ev.tool, ts: ev.ts }, ...prev.filter((c) => c.key !== key)]; return [{ key, kind: ev.kind, target: ev.target, tool: ev.tool, status: "idle" as const, ts: ev.ts }, ...prev].slice(0, MAX_ITEMS); });
      const cfg = cfgRef.current; if (cfg.autoExplain && cfg.providerId) enqueue(key);
    };
    return () => es.close();
  }, [root, enqueue]);

  // #994 서버 기록 로드 — ① 옛 localStorage 기록 있으면 1회 이관(서버가 key로 멱등) 후 삭제 ② 최근 100개 로드해
  // SSE로 먼저 들어온 항목과 key 병합(최신순). 이관 실패하면 로컬 키를 남겨 다음 마운트에 재시도.
  useEffect(() => {
    if (!root) return;
    let alive = true;
    (async () => {
      const legacy = load<Concept>(cKey(root)).filter((c) => c.status === "done" && c.expl);
      if (legacy.length) {
        const ok = await saveItems(root, legacy.map((c) => ({ key: c.key, kind: c.kind, target: c.target, tool: c.tool, ts: c.ts, expl: c.expl ?? "" })));
        if (ok) { try { localStorage.removeItem(cKey(root)); } catch { /* 무시 */ } }
      }
      let items: Concept[] = [];
      try {
        const j = await (await fetch(`/api/repo/stream?root=${encodeURIComponent(root)}&limit=100`)).json();
        if (j?.ok && Array.isArray(j.items)) items = (j.items as Omit<Concept, "status">[]).map((x) => ({ ...x, status: "done" as const }));
      } catch { /* 서버 미준비 — 실시간만 */ }
      if (!alive) return;
      for (const c of items) seenRef.current.add(c.key);
      setConcepts((prev) => { const have = new Set(prev.map((c) => c.key)); return [...prev, ...items.filter((c) => !have.has(c.key))].sort((a, b) => b.ts - a.ts); });
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [root]);
  // 용어집은 그대로 localStorage(작고 레포별 누적).
  useEffect(() => { try { if (typeof localStorage !== "undefined") localStorage.setItem(gKey(root), JSON.stringify(terms.slice(0, 80))); } catch { /* 무시 */ } }, [terms, root]);

  useEffect(() => {
    if (!concepts.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 상대시간 초기 스냅
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id);
  }, [concepts.length]);

  const toggleExpand = useCallback((key: string) => { if (!seenRef.current.has(key) && cfgRef.current.providerId) enqueue(key); }, [enqueue]);

  // #996 캘린더 되돌아보기 — 달력 열 때 기록 있는 날짜 로드, 지난 날 고르면 그날 파일만. 실시간(concepts)은 뒤에서 계속 갱신.
  const [calOpen, setCalOpen] = useState(false);
  const [days, setDays] = useState<Set<string>>(() => new Set());
  const [viewDay, setViewDay] = useState<string | null>(null);
  const [dayItems, setDayItems] = useState<Concept[] | null>(null); // null = 로딩 중
  const closeCal = useCallback(() => setCalOpen(false), []);
  const openCal = useCallback(() => {
    if (calOpen) { setCalOpen(false); return; }
    setCalOpen(true);
    fetch(`/api/repo/stream?root=${encodeURIComponent(root)}&days=1`).then((r) => r.json())
      .then((j) => { if (j?.ok && Array.isArray(j.days)) setDays(new Set(j.days as string[])); }).catch(() => { /* 오늘만 */ });
  }, [root, calOpen]);
  const listRef = useRef<HTMLDivElement>(null);
  const pickDay = useCallback((day: string | null) => {
    setCalOpen(false);
    setViewDay(day);
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 0 })); // 날짜 전환·맨 위로 → 최신(맨 위)부터(유저 요청)
    if (!day) return;
    setDayItems(null);
    fetch(`/api/repo/stream?root=${encodeURIComponent(root)}&day=${day}`).then((r) => r.json())
      .then((j) => setDayItems(j?.ok && Array.isArray(j.items) ? (j.items as Omit<Concept, "status">[]).map((x) => ({ ...x, status: "done" as const })) : []))
      .catch(() => setDayItems([]));
  }, [root]);
  const shown = viewDay ? (dayItems ?? []) : concepts;
  const viewLabel = viewDay ? (() => { try { return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(new Date(`${viewDay}T00:00:00`)); } catch { return viewDay; } })() : "";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white dark:bg-[var(--s-pane)]">
      <div className="relative flex shrink-0 items-center gap-1.5 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <IconActivity size={14} stroke={2} className="shrink-0 text-mustard-600 dark:text-mustard-400" aria-hidden />
        <span className="mr-auto truncate text-[13px] font-semibold text-zinc-700 dark:text-zinc-200" title={t("learn.mode")}>{t("learn.title")}</span>
        <button type="button" data-cal-toggle onClick={openCal} aria-expanded={calOpen} title={t("learn.calendar")} aria-label={t("learn.calendar")}
          className={`rounded-md p-1 transition ${calOpen || viewDay ? "text-mustard-600 dark:text-mustard-400" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"}`}>
          <IconCalendar size={14} stroke={2} aria-hidden />
        </button>
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400" title={t("learn.autoExplain")}>
          <input type="checkbox" checked={autoExplain} onChange={(e) => setAutoExplain(e.target.checked)} /> {t("learn.autoExplain")}
        </label>
        <span className={`flex items-center gap-1 text-[10px] ${live ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500"}`}><IconPointFilled size={10} stroke={2} aria-hidden /> {live ? t("learn.live") : t("learn.idle")}</span>
        {calOpen && <CatchupCalendar days={days} selected={viewDay} locale={locale} onPick={pickDay} onClose={closeCal} />}
      </div>
      {/* 지난 날 보는 중 안내 바 — 오늘로 복귀(그사이 실시간 항목 바로 보임) */}
      {viewDay && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-mustard-500/30 bg-mustard-500/10 px-3 py-1.5 text-[11px] text-mustard-700 dark:text-mustard-400">
          <IconCalendar size={12} stroke={2} className="shrink-0" aria-hidden />
          <span className="mr-auto truncate">{t("learn.viewingDay", { date: viewLabel })}</span>
          <button type="button" onClick={() => pickDay(null)} className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium hover:bg-mustard-500/15">
            <IconArrowBarToUp size={11} stroke={2} aria-hidden /> {t("learn.backToToday")}
          </button>
        </div>
      )}
      <div ref={listRef} className="nunopi-scroll min-h-0 flex-1 overflow-y-auto">
        {viewDay && dayItems === null ? (
          <div className="flex justify-center py-6"><IconLoader2 size={14} stroke={2} className="animate-spin text-zinc-400" aria-hidden /></div>
        ) : viewDay && !shown.length ? (
          <p className="px-4 py-6 text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">{t("learn.dayEmpty")}</p>
        ) : !loaded && !concepts.length ? null : !concepts.length && !terms.length ? (
          <p className="px-4 py-6 text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">{t("learn.empty")}</p>
        ) : (
          <>
            {/* 용어집 — 이해에 필요한 용어 누적(중복 없음) */}
            {terms.length > 0 && !viewDay && ( /* 용어집은 날짜 무관 누적 → 지난 날 보기에선 숨김(#996) */
              <div className="border-b border-zinc-100 dark:border-zinc-800/70">
                <button type="button" onClick={() => setTermsOpen((v) => !v)} className="flex w-full items-center gap-1.5 px-3 py-2 text-left">
                  <IconBook2 size={13} stroke={2} className="shrink-0 text-mustard-600 dark:text-mustard-400" aria-hidden />
                  <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{t("learn.terms")} ({terms.length})</span>
                  <IconChevronDown size={13} stroke={2} className={`ml-auto shrink-0 text-zinc-400 transition ${termsOpen ? "" : "-rotate-90"}`} aria-hidden />
                </button>
                {termsOpen && <ul className="flex flex-col gap-1 px-3 pb-2.5">
                  {terms.map((x) => (<li key={x.term} className="text-[11px] leading-snug"><span className="font-semibold text-zinc-700 dark:text-zinc-200">{x.term}</span> <span className="text-zinc-500 dark:text-zinc-400">— {x.def}</span></li>))}
                </ul>}
              </div>
            )}
            {/* 개념 — 등장한 개념 1회씩(중복 없음), 최근 먼저 */}
            <ul className="flex flex-col gap-2 p-2.5">
              {shown.map((c, i) => { const Icon = KIND_ICON[c.kind] ?? IconActivity; const today = dayOf(c.ts) === dayOf(now || Date.now()); return ( // 미지 kind(구버전/영속 데이터)여도 크래시 안 나게 fallback
                <Fragment key={c.key}>
                {/* #994 날짜 구분선(카톡式) — 최신순 목록에서 날짜가 바뀌는 첫 항목 위 */}
                {(i === 0 || dayOf(shown[i - 1].ts) !== dayOf(c.ts)) && (
                  <li role="separator" className="flex items-center gap-2 py-1">
                    <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden />
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{fmtDay(c.ts, locale)}</span>
                    <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden />
                  </li>
                )}
                <li className="rounded-lg border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <button type="button" onClick={() => toggleExpand(c.key)} className="flex w-full items-start gap-2 px-3 py-2 text-left">
                    <Icon size={14} stroke={2} className="mt-0.5 shrink-0 text-mustard-600 dark:text-mustard-400" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block break-all text-[12px] font-medium text-zinc-700 dark:text-zinc-100">{c.target}</span>
                      <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">{c.kind === "narration" ? fmtDateTime(c.ts) : `${c.tool.replace(/^katchup_/, "")} · ${today ? ago(c.ts, now || c.ts) : fmtDateTime(c.ts)}`}</span>
                    </span>
                    {c.status === "loading" && <IconLoader2 size={12} stroke={2} className="mt-0.5 shrink-0 animate-spin text-zinc-400" aria-hidden />}
                  </button>
                  {(c.status === "done" || c.status === "error") && (
                    <div className="border-t border-zinc-200/70 px-3 py-2 text-[11.5px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                      {c.status === "done" ? <Markdown>{c.expl ?? ""}</Markdown> : <span className="text-[10px] text-rose-500">{t("learn.explainError")}</span>}
                    </div>
                  )}
                </li>
                </Fragment>
              ); })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
