"use client";

import { useEffect, useState } from "react";
import { IconCode, IconMessage2, IconMessageQuestion, IconListCheck, IconCards, IconBrain, IconLoader2, type IconProps } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import { collectHistory } from "@/lib/history/collect";
import { dayKey } from "@/lib/srs/activityLog";
import { CARDS_CHANGED_EVENT } from "@/lib/chatCard";
import { CARD_CHAT_CHANGED_EVENT } from "@/lib/cardChat";
import type { HistoryEventType, HistoryNav, UnifiedHistoryEvent } from "@/lib/history/types";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

// 타입별 아이콘·색(브랜드 계열 + 구분).
// 유형별 뚜렷한 색(계열 겹침 방지) — 인디고/스카이/에메랄드/푸시아/앰버/로즈.
const TYPE_META: Record<HistoryEventType, { Icon: React.ComponentType<IconProps>; cls: string }> = {
  analysis: { Icon: IconCode, cls: "text-[#3B34E2] dark:text-[#8b86f5]" }, // 브랜드 인디고
  chat: { Icon: IconMessage2, cls: "text-sky-500" },                       // 스카이
  ask: { Icon: IconMessageQuestion, cls: "text-emerald-500" },             // 에메랄드(초록)
  quiz: { Icon: IconListCheck, cls: "text-fuchsia-500" },                  // 푸시아(마젠타)
  bookmark: { Icon: IconCards, cls: "text-amber-500" },                    // 앰버(주황)
  review: { Icon: IconBrain, cls: "text-rose-500" },                       // 로즈(빨강)
};

// 전역 히스토리 좌 타임라인 — 모든 저장소 수집(collectHistory) → 날짜별 그룹 렌더.
// 클릭 이동은 자식 #4에서. 지금은 표시 + 활동 변경 시 재수집.
const ALL_TYPES: HistoryEventType[] = ["analysis", "chat", "ask", "quiz", "bookmark", "review"];
const FILTER_KEY = "nunopi:history-filter";

export default function HistoryTimeline({ onNavigate }: { onNavigate?: (nav: HistoryNav) => void }) {
  const t = useT();
  const { locale } = useLocale();
  const tag = LOCALE_TAG[locale] ?? "en-US";
  const [events, setEvents] = useState<UnifiedHistoryEvent[] | null>(null);
  // 타입 필터 — 기본 전부. SSR 안전 위해 전부로 시작, 마운트 후 저장값 복원.
  const [enabled, setEnabled] = useState<Set<HistoryEventType>>(() => new Set(ALL_TYPES));
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(FILTER_KEY) ?? "");
      if (Array.isArray(raw)) {
        const s = new Set(raw.filter((x): x is HistoryEventType => ALL_TYPES.includes(x)));
        if (s.size) setEnabled(s); // eslint-disable-line react-hooks/set-state-in-effect
      }
    } catch { /* ignore */ }
  }, []);
  function toggleType(ty: HistoryEventType) {
    setEnabled((prev) => {
      const n = new Set(prev);
      if (n.has(ty)) n.delete(ty); else n.add(ty);
      try { localStorage.setItem(FILTER_KEY, JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
  }

  useEffect(() => {
    // 언마운트 후 setState 방지 가드(collectHistory 비동기 완료가 언마운트 뒤일 수 있음).
    let alive = true;
    const reload = () => { void collectHistory().then((ev) => { if (alive) setEvents(ev); }); };
    reload();
    window.addEventListener(CARDS_CHANGED_EVENT, reload);
    window.addEventListener(CARD_CHAT_CHANGED_EVENT, reload);
    window.addEventListener("focus", reload);
    return () => {
      alive = false;
      window.removeEventListener(CARDS_CHANGED_EVENT, reload);
      window.removeEventListener(CARD_CHAT_CHANGED_EVENT, reload);
      window.removeEventListener("focus", reload);
    };
  }, []);

  if (events === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-zinc-400 dark:text-zinc-500">
        <IconLoader2 size={20} stroke={2} className="animate-spin" aria-hidden />
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <p className="text-[13px] text-zinc-400 dark:text-zinc-500">{t("home.empty")}</p>
      </div>
    );
  }

  // 이력에 존재하는 유형만 칩으로 노출. 필터 적용 후 날짜 그룹.
  const present = ALL_TYPES.filter((ty) => events.some((e) => e.type === ty));
  const filtered = events.filter((e) => enabled.has(e.type));
  // 날짜별 그룹(이미 desc 정렬이라 최초 등장 순 = 최신 날짜부터).
  const groups: { day: string; items: UnifiedHistoryEvent[] }[] = [];
  for (const e of filtered) {
    const d = new Date(e.createdAt);
    const k = Number.isNaN(d.getTime()) ? "?" : dayKey(d);
    const last = groups[groups.length - 1];
    if (last && last.day === k) last.items.push(e);
    else groups.push({ day: k, items: [e] });
  }

  const dayLabel = (k: string) => {
    if (k === "?") return "?";
    const d = new Date(k + "T00:00:00");
    return d.toLocaleDateString(tag, { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  };
  const timeLabel = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 타입 필터 칩 — 이력에 있는 유형만. 클릭 토글(영속). */}
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 px-3 pb-2.5 dark:border-zinc-800">
        {present.map((ty) => {
          const { Icon, cls } = TYPE_META[ty];
          const on = enabled.has(ty);
          return (
            <button
              key={ty}
              type="button"
              onClick={() => toggleType(ty)}
              aria-pressed={on}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition ${
                on ? `border-current ${cls}` : "border-zinc-200 text-zinc-400 opacity-60 dark:border-zinc-700 dark:text-zinc-500"
              }`}
            >
              <Icon size={12} stroke={2} aria-hidden />
              {t(`home.evt.${ty}`)}
            </button>
          );
        })}
      </div>
      {groups.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500">{t("home.noFiltered")}</p>
        </div>
      ) : (
        <div className="nunopi-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
          {groups.map((g) => (
        <div key={g.day} className="mb-3">
          <div className="sticky -top-3 z-10 -mx-3 bg-zinc-50 px-3 py-2 text-[11px] font-semibold text-zinc-500 dark:bg-[#13141b] dark:text-zinc-400">
            {dayLabel(g.day)}
          </div>
          <div className="flex flex-col gap-1">
            {g.items.map((e) => {
              const { Icon, cls } = TYPE_META[e.type];
              const clickable = !!(e.nav && onNavigate);
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => { if (e.nav) onNavigate?.(e.nav); }}
                  className={`flex w-full items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left transition dark:border-zinc-800 dark:bg-zinc-900 ${clickable ? "cursor-pointer hover:border-[#3B34E2] dark:hover:border-[#8b86f5]" : "cursor-default"}`}
                >
                  <Icon size={15} stroke={2} className={`mt-0.5 shrink-0 ${cls}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`shrink-0 text-[10px] font-semibold uppercase ${cls}`}>{t(`home.evt.${e.type}`)}</span>
                      {e.type !== "review" && <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">{timeLabel(e.createdAt)}</span>}
                    </div>
                    <p className="truncate text-[13px] text-zinc-700 dark:text-zinc-200">{e.title}</p>
                    {e.description && <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{e.description}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
        </div>
      )}
    </div>
  );
}
