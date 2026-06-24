import { IconLock, IconMessageCircle } from "@tabler/icons-react";
import type { ItTerm } from "@/lib/translator/types";
import { highlightTerms } from "@/lib/highlightTerms";

interface TextInputAreaProps {
  code: string; // 붙여넣은 글(분석 입력).
  isLoading: boolean;
  onCodeChange: (next: string) => void;
  chatOpen?: boolean;
  onToggleChat?: () => void;
  // 분석 결과가 있으면 입력 잠금(실수 수정 방지). 클리어로만 새 입력.
  locked?: boolean;
  onClear?: () => void;
  // 분석된 IT 용어 — locked 읽기 오버레이에서 하이라이트/클릭에 사용.
  terms?: ItTerm[];
  // 글 안의 용어를 클릭하면 학습패널의 그 용어 카드로 스크롤(termId 전달).
  onTermClick?: (termId: string) => void;
}

// 글(IT 용어) 분석 모드 입력 — 산문을 붙여넣는 plain textarea.
// (코드 모드의 Monaco 에디터는 산문 하이라이팅이 부적합해 별도 컴포넌트로 둔다.)
export default function TextInputArea({ code, isLoading, onCodeChange, chatOpen, onToggleChat, locked = false, onClear, terms, onTermClick }: TextInputAreaProps) {
  const charCount = code.trim().length;
  // 분석 완료(locked)면 textarea 대신 읽기 오버레이로 용어를 하이라이트한다.
  const showHighlighted = locked && (terms?.length ?? 0) > 0;
  const segments = showHighlighted ? highlightTerms(code, terms ?? []) : [];

  return (
    <div className="flex h-full flex-col gap-2 bg-zinc-50 p-4 dark:bg-[#111219]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          글 입력 (IT 용어가 가득한 글을 붙여넣어 보세요)
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{charCount}자</span>
          {locked && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-red-100 hover:text-red-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              title="입력을 비우고 새 글을 분석"
            >
              <IconLock size={14} stroke={2} aria-hidden /> 클리어
            </button>
          )}
          {onToggleChat && (
            <button
              type="button"
              onClick={onToggleChat}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                chatOpen
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
              title="학습 챗 열기/닫기"
            >
              <IconMessageCircle size={14} stroke={2} aria-hidden /> 질문
            </button>
          )}
        </div>
      </div>

      {/* flex-1로 데스크톱 높이를 채우고, 모바일에선 min-h로 바닥 확보 */}
      <div className="min-h-[320px] flex-1">
        {showHighlighted ? (
          // 읽기 오버레이 — 분석된 용어를 클릭 가능한 하이라이트로. 줄바꿈/공백 보존.
          <div className="nunopi-scroll h-full w-full overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            {segments.map((seg, idx) =>
              seg.termId ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onTermClick?.(seg.termId!)}
                  className="rounded bg-blue-100 px-0.5 font-medium text-blue-700 underline decoration-blue-400 decoration-dotted underline-offset-2 transition hover:bg-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60"
                  title="학습 패널에서 이 용어 보기"
                >
                  {seg.text}
                </button>
              ) : (
                <span key={idx}>{seg.text}</span>
              ),
            )}
          </div>
        ) : (
          <textarea
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            disabled={isLoading}
            readOnly={locked}
            spellCheck={false}
            placeholder={
              "예) 쿠버네티스 파드가 OOM으로 죽어서 HPA가 스케일아웃했는데도 p99 레이턴시가 안 잡히고 캐시 히트율이 떨어진다…\n" +
              "기술 블로그·릴리스 노트·X 피드처럼 모르는 IT 용어(컨테이너, 비동기 큐, CI/CD…)가 잔뜩인 글을 그대로 붙여넣으세요."
            }
            className="h-full w-full resize-none rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600"
          />
        )}
      </div>
    </div>
  );
}
