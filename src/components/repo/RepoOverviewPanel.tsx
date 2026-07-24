"use client";

import { useEffect, useRef, useState } from "react";
import { IconX, IconChevronRight, IconSparkles, IconLoader2 } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import Markdown from "@/components/learning/Markdown";
import { parseCardSuggestions, stripStreamingCardBlock } from "@/lib/cardSuggestion";
import { groupColors } from "@/lib/repo/colors";
import type { RepoOverview } from "@/lib/repo/overview";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";
import type { RepoGraph } from "@/lib/repo/types";

type StreamEvent =
  | { type: "progress"; line: string }
  | { type: "result"; response: { summary: string } }
  | { type: "error"; message: string };

// "레포 한눈에" 온보딩 패널 — 비개발자용 요약(덩어리·핵심 파일·시작점 + 쉬운 말 LLM 요약). 그래프 위 오버레이.
export default function RepoOverviewPanel({ overview, graph, providerId, providerSettings, summary, onSummarized, onSelect, onClose }: {
  overview: RepoOverview;
  graph: RepoGraph;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
  summary?: string;                  // 캐시된 쉬운 말 요약(있으면 바로 표시)
  onSummarized: (text: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // 통계·핵심 파일명만으로 "이 레포 뭐 하는 앱?" 쉬운 말 요약 생성(온디맨드·스트림).
  async function summarize() {
    if (generating) return;
    setGenerating(true); setStreaming(""); setError(false);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const groups = overview.groups.map((g) => `${g.group}(${g.count})`).join(", ");
      const gods = overview.godNodes.map((n) => n.label).join(", ") || "(없음)";
      const entries = overview.entryPoints.map((n) => n.label).join(", ") || "(없음)";
      const ctx = `# 레포 요약 재료\n파일 ${graph.stats.files}개 · 연결 ${graph.stats.edges}개\n폴더별: ${groups}\n핵심 파일(연결 많음): ${gods}\n시작점: ${entries}`;
      const ask = "위 구조 정보만 보고 이 레포가 대략 어떤 프로젝트/앱인지 비개발자도 이해하게 쉬운 말로 2~3문장 요약해줘. 확신 없으면 '추정'이라 표기. 불릿 없이 짧은 문단.";
      const thread: ChatMessage[] = [{ role: "user", content: ask }];
      const res = await fetch("/api/agent/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, request: { code: ctx, locale, providerId, mode: "chat", messages: thread, providerSettings } }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) { if (!ac.signal.aborted) setError(true); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          let ev: StreamEvent;
          try { ev = JSON.parse(l) as StreamEvent; } catch { continue; }
          if (ev.type === "progress" && providerId !== "codex-agent" && !ac.signal.aborted) setStreaming(ev.line);
          else if (ev.type === "result") answer = ev.response.summary;
        }
      }
      if (!ac.signal.aborted) onSummarized(parseCardSuggestions(answer || "").text || answer || "(빈 응답)");
    } catch {
      if (!ac.signal.aborted) setError(true);
    } finally {
      if (!ac.signal.aborted) { setGenerating(false); setStreaming(null); }
    }
  }

  const colors = groupColors(overview.groups.map((g) => g.group));
  const maxCount = overview.groups[0]?.count ?? 1; // 막대 길이 정규화 기준
  const empty = !overview.groups.length && !overview.godNodes.length && !overview.entryPoints.length;

  return (
    <div className="nunopi-scroll absolute right-2 top-2 z-10 flex max-h-[calc(100%-1rem)] w-72 flex-col gap-3 overflow-y-auto rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-[#111219]/95">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{t("repo.overviewTitle")}</span>
        <button type="button" onClick={onClose} className="ml-auto rounded-md p-0.5 text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200" aria-label={t("repo.node.close")}>
          <IconX size={15} stroke={2} aria-hidden />
        </button>
      </div>

      {/* 쉬운 말 요약 — 온디맨드 LLM. 캐시 있으면 바로, 없으면 버튼. */}
      <section className="flex flex-col gap-1.5">
        <h3 className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          <IconSparkles size={12} stroke={2} aria-hidden /> {t("repo.overviewSummaryTitle")}
        </h3>
        {summary ? (
          <div className="select-text text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-200"><Markdown>{summary}</Markdown></div>
        ) : streaming != null ? (
          <div className="select-text text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-200">
            {streaming ? <Markdown>{stripStreamingCardBlock(streaming)}</Markdown> : <span className="inline-flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500"><IconLoader2 size={12} stroke={2} className="animate-spin" aria-hidden />{t("repo.overviewSummarizing")}</span>}
          </div>
        ) : (
          <>
            <button type="button" onClick={summarize} disabled={generating} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#3B34E2] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#322bc9] disabled:opacity-50 dark:bg-[#8b86f5] dark:text-zinc-900 dark:hover:bg-[#a5a0f8]">
              <IconSparkles size={13} stroke={2} aria-hidden />{t("repo.overviewSummarize")}
            </button>
            {error && <span className="text-[12px] text-rose-500">{t("repo.overviewSummaryError")}</span>}
          </>
        )}
      </section>

      {empty ? (
        <p className="text-[12px] text-zinc-400 dark:text-zinc-500">{t("repo.overviewEmpty")}</p>
      ) : (
        <>
          {/* 덩어리 — 폴더별 파일 수 막대 */}
          {overview.groups.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{t("repo.overviewGroups")}</h3>
              {overview.groups.slice(0, 8).map(({ group, count }) => (
                <div key={group} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors.get(group) ?? "#71717a" }} />
                  <span className="w-24 truncate text-zinc-700 dark:text-zinc-200" title={group}>{group}</span>
                  <span className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" style={{ width: `${Math.max(6, (count / maxCount) * 100)}%` }} />
                  <span className="ml-auto shrink-0 tabular-nums text-zinc-400 dark:text-zinc-500">{count}</span>
                </div>
              ))}
            </section>
          )}

          {/* 핵심 파일 — degree 순, 클릭 시 선택 */}
          {overview.godNodes.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{t("repo.overviewGod")}</h3>
              <p className="text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">{t("repo.overviewGodHint")}</p>
              {overview.godNodes.map(({ id, label, degree }) => (
                <button key={id} type="button" onClick={() => onSelect(id)} className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[12px] transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <IconChevronRight size={12} stroke={2} className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
                  <span className="truncate text-zinc-700 dark:text-zinc-200" title={id}>{label}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-zinc-400 dark:text-zinc-500">{degree}</span>
                </button>
              ))}
            </section>
          )}

          {/* 시작점 — in0 & out>0 */}
          {overview.entryPoints.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{t("repo.overviewEntry")}</h3>
              <p className="text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">{t("repo.overviewEntryHint")}</p>
              {overview.entryPoints.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => onSelect(id)} className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[12px] transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <IconChevronRight size={12} stroke={2} className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
                  <span className="truncate text-zinc-700 dark:text-zinc-200" title={id}>{label}</span>
                </button>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
