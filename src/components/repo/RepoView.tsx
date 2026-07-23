"use client";

import { IconSitemap, IconFolderOpen } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";

// 레포 분석 모드 — 로컬 레포 폴더 → 아키텍처 그래프 + 노드 설명/챗(부모 #585).
// 이번 자식(#586)은 뼈대 + 빈 스켈레톤. 폴더 선택 실동작(자식 2)·파싱(자식 3)·그래프(자식 4+)는 후속.
export default function RepoView({ active = true }: { active?: boolean }) {
  const t = useT();
  return (
    <div aria-hidden={!active} className="flex h-full w-full min-h-0 items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-[#3B34E2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-[#8b86f5]">
          <IconSitemap size={28} stroke={2} aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{t("repo.title")}</h2>
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{t("repo.intro")}</p>
        </div>
        {/* 폴더 선택 — 자식 2에서 실동작. 지금은 자리(비활성). */}
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-xl bg-[#3B34E2] px-4 py-2 text-[13px] font-semibold text-white opacity-50 dark:bg-[#8b86f5] dark:text-zinc-900"
        >
          <IconFolderOpen size={16} stroke={2} aria-hidden />
          {t("repo.pickFolder")}
        </button>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{t("repo.soon")}</p>
      </div>
    </div>
  );
}
