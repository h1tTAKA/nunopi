interface TextInputAreaProps {
  code: string; // 붙여넣은 글(분석 입력).
  isLoading: boolean;
  onCodeChange: (next: string) => void;
}

// 글(IT 용어) 분석 모드 입력 — 산문을 붙여넣는 plain textarea.
// (코드 모드의 Monaco 에디터는 산문 하이라이팅이 부적합해 별도 컴포넌트로 둔다.)
export default function TextInputArea({ code, isLoading, onCodeChange }: TextInputAreaProps) {
  const charCount = code.trim().length;

  return (
    <div className="flex h-full flex-col gap-2 bg-zinc-50 p-4 dark:bg-black">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          글 입력 (IT 용어가 가득한 글을 붙여넣어 보세요)
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{charCount}자</span>
      </div>

      {/* flex-1로 데스크톱 높이를 채우고, 모바일에선 min-h로 바닥 확보 */}
      <div className="min-h-[320px] flex-1">
        <textarea
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          disabled={isLoading}
          spellCheck={false}
          placeholder={
            "예) 미니 디파이를 만들어줘. 예치, 스왑, 이자 계산, 청산 구조가 들어가게…\n" +
            "AMM, LP, 슬리피지, 오라클, 청산, 담보비율 같은 모르는 IT 용어가 잔뜩인 글을 그대로 붙여넣으세요."
          }
          className="h-full w-full resize-none rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600"
        />
      </div>
    </div>
  );
}
