"use client";

import { useT } from "@/lib/i18n/I18nProvider";

// 암기 모드 최상위 뷰. ②에선 빈 셸 — 덱 선택(③)/카드 세션(④)이 채운다.
export default function MemorizeView() {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <p className="text-sm text-zinc-400 dark:text-zinc-500">{t("mem.comingSoon")}</p>
    </div>
  );
}
