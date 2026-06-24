"use client";

import type { AgentProviderKind } from "@/lib/agent";
import { PROVIDER_CATALOG } from "@/lib/agent/catalog";

// 입력 패널 헤더에 분산 배치되는 분석 컨트롤 조각들 — 코드/글 입력 영역 공용.
// (예전 ProviderToolbar strip을 해체해 여기로 옮김.)

export function ProviderSelect({
  providerId,
  onProviderChange,
  disabled = false,
}: {
  providerId: AgentProviderKind;
  onProviderChange: (id: AgentProviderKind) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={providerId}
      disabled={disabled}
      onChange={(e) => onProviderChange(e.target.value as AgentProviderKind)}
      aria-label="분석 provider 선택"
      title="분석 provider"
      className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500"
    >
      {PROVIDER_CATALOG.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

// 단일 버튼이 상태에 따라 교체:
//  분석중→멈추기(회색) / 중단·resumable→이어서하기 / 완료(locked)→재분석 요청(경고 confirm) / else→분석요청하기.
const REANALYZE_WARNING =
  "재분석하시게 되면 현재 분석 내용이 사라지고 분석 내용이 달라질 수 있습니다. 재분석하시겠습니까?";

export function AnalyzeButton({
  isLoading,
  resumable = false,
  locked = false,
  onAnalyze,
  onCancel,
  onResume,
}: {
  isLoading: boolean;
  resumable?: boolean;
  locked?: boolean;
  onAnalyze: () => void | Promise<void>;
  onCancel: () => void;
  onResume?: () => void;
}) {
  if (isLoading) {
    return (
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 whitespace-nowrap rounded-lg bg-zinc-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
      >
        ■ 멈추기
      </button>
    );
  }
  if (resumable && onResume) {
    return (
      <button
        type="button"
        onClick={onResume}
        title="멈춘 지점부터 안 된 부분만 이어서 분석"
        className="shrink-0 whitespace-nowrap rounded-lg bg-[#3B34E2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9]"
      >
        ▸ 이어서하기
      </button>
    );
  }
  // 이미 분석이 끝난 입력 → 재분석은 기존 결과를 덮어쓰므로 경고 confirm 후 진행.
  if (locked) {
    return (
      <button
        type="button"
        onClick={() => {
          if (window.confirm(REANALYZE_WARNING)) void onAnalyze();
        }}
        title="현재 입력을 다시 분석(기존 결과는 사라짐)"
        className="shrink-0 whitespace-nowrap rounded-lg bg-[#3B34E2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9]"
      >
        재분석 요청
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        void onAnalyze();
      }}
      className="shrink-0 whitespace-nowrap rounded-lg bg-[#3B34E2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9]"
    >
      분석 요청하기
    </button>
  );
}

export function AnalyzeError({ message, onRetry }: { message: string; onRetry: () => void | Promise<void> }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          void onRetry();
        }}
        className="font-medium underline hover:no-underline"
      >
        다시 시도
      </button>
    </div>
  );
}
