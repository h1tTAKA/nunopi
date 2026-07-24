"use client";

import { IconX, IconChevronRight } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { groupColors } from "@/lib/repo/colors";
import type { RepoOverview } from "@/lib/repo/overview";

// "레포 한눈에" 온보딩 패널 — 비개발자용 요약(덩어리·핵심 파일·시작점). 그래프 위 오버레이.
export default function RepoOverviewPanel({ overview, onSelect, onClose }: {
  overview: RepoOverview;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
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
