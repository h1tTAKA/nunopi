"use client";

import { useEffect, useState } from "react";
import { IconSparkles, IconFolderShare } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { loadCustomDecks, CUSTOM_DECKS_CHANGED_EVENT } from "@/lib/srs/customDeck";
import type { AgentProviderKind, ProviderSettings } from "@/lib/agent";
import AgentDeckModal from "./AgentDeckModal";
import AgentAssignModal from "./AgentAssignModal";

type HubMode = "create" | "assign";

// 덱 커스터마이징 통합 패널 — 갤러리 위 중앙 오버레이(풀스크린 X).
// 우측 헤더의 모드 토글로 [에이전트 덱 생성](AgentDeckModal) / [기존 덱 추가](AgentAssignModal)를 스왑.
// 두 모달을 embedded로 끼워 로직·파싱을 그대로 재사용한다.
export default function AgentDeckHubModal({
  now, providerId, providerSettings, onClose, onCreated,
}: {
  now: Date;
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<HubMode>("create");
  // 기존 덱 추가에서 "새 덱 만들기" 눌렀을 때 덱 생성 대화에 자동으로 심을 씨앗 프롬프트.
  const [seedPrompt, setSeedPrompt] = useState<string | undefined>(undefined);
  // 커스텀 덱이 하나도 없으면 '기존 덱 추가'는 불가 → 토글 비활성.
  const [hasDecks, setHasDecks] = useState(false);
  useEffect(() => {
    const load = () => setHasDecks(loadCustomDecks().length > 0);
    load();
    window.addEventListener(CUSTOM_DECKS_CHANGED_EVENT, load);
    return () => window.removeEventListener(CUSTOM_DECKS_CHANGED_EVENT, load);
  }, []);
  // 덱이 사라지면 create로 되돌린다(assign 화면에 남지 않게).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasDecks && mode === "assign") setMode("create");
  }, [hasDecks, mode]);

  const toggle = (
    <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
      <button
        type="button"
        onClick={() => setMode("create")}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${mode === "create" ? "bg-[#3B34E2] text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}
      >
        <IconSparkles size={13} stroke={2} aria-hidden /> {t("mem.hubModeCreate")}
      </button>
      <button
        type="button"
        onClick={() => setMode("assign")}
        disabled={!hasDecks}
        title={!hasDecks ? t("mem.customizeAssignNone") : undefined}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${mode === "assign" ? "bg-[#3B34E2] text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}
      >
        <IconFolderShare size={13} stroke={2} aria-hidden /> {t("mem.hubModeAssign")}
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative h-[86vh] w-[min(94vw,1000px)] overflow-hidden rounded-2xl border border-zinc-200 shadow-2xl dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "create" ? (
          <AgentDeckModal
            now={now}
            providerId={providerId}
            providerSettings={providerSettings}
            onBack={onClose}
            onCreated={onCreated}
            seedPrompt={seedPrompt}
            embedded
            headerRight={toggle}
          />
        ) : (
          <AgentAssignModal
            now={now}
            providerId={providerId}
            providerSettings={providerSettings}
            onBack={onClose}
            onApplied={onClose}
            onSwitchToCreate={(seed) => { setSeedPrompt(seed); setMode("create"); }}
            embedded
            headerRight={toggle}
          />
        )}
      </div>
    </div>
  );
}
