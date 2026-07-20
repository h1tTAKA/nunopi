"use client";

import { useRef, useState, useEffect } from "react";
import { IconListCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";
import { newAskId, type QuizSession, type AskQuiz } from "@/lib/askStore";
import QuizRunner from "@/components/ask/QuizRunner";

// Ask 아웃풋 퀴즈 패널(겉) — 세션 여러 개 관리(칩바·새 퀴즈·삭제) + 폭 리사이즈. 실행부는 QuizRunner(#548).

// 패널 폭(px) — 드래그로 조절, localStorage 영속. 우측 패널이라 왼쪽 모서리를 잡아 늘린다.
const QUIZ_MIN = 280;
const QUIZ_MAX = 560;
const QUIZ_DEFAULT = 320;
const QUIZ_WIDTH_KEY = "nunopi.ask.quizWidth";
const clampQuiz = (w: number) => Math.min(QUIZ_MAX, Math.max(QUIZ_MIN, w));

const EMPTY_QUIZ: AskQuiz = { phase: "idle", questions: [], answers: {}, graded: {} };

export default function AskSessionQuiz({ messages, providerId, providerSettings, quizzes, activeQuizId, onQuizzesChange }: {
  messages: ChatMessage[];
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
  quizzes: QuizSession[];
  activeQuizId?: string;
  onQuizzesChange: (quizzes: QuizSession[], activeQuizId: string | undefined) => void;
}) {
  const t = useT();
  const confirm = useConfirm();
  const active = quizzes.find((q) => q.id === activeQuizId) ?? quizzes[0];

  // ── 세션 조작 ──────────────────────────────
  function addQuiz() {
    const session: QuizSession = { id: newAskId(), createdAt: new Date().toISOString(), quiz: EMPTY_QUIZ };
    onQuizzesChange([...quizzes, session], session.id);
  }
  // 활성 세션의 quiz 갱신(QuizRunner가 상태 바뀔 때 호출). undefined면 빈 idle로(세션은 유지).
  function updateActiveQuiz(next: AskQuiz | undefined) {
    if (!active) return;
    const quiz = next ?? EMPTY_QUIZ;
    onQuizzesChange(quizzes.map((q) => (q.id === active.id ? { ...q, quiz } : q)), active.id);
  }
  async function deleteQuiz(id: string) {
    if (!(await confirm({ title: t("quiz.confirmDeleteTitle"), message: t("quiz.confirmDeleteMsg") }))) return;
    const remaining = quizzes.filter((q) => q.id !== id);
    const nextActive = id === active?.id ? remaining[remaining.length - 1]?.id : activeQuizId;
    onQuizzesChange(remaining, nextActive);
  }

  // ── 폭 리사이즈 ────────────────────────────
  const [width, setWidth] = useState(QUIZ_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const resizingRef = useRef(false);
  const widthRef = useRef(QUIZ_DEFAULT);
  const asideRef = useRef<HTMLElement>(null);
  const anchorRightRef = useRef(0);

  useEffect(() => {
    const stored = Number(localStorage.getItem(QUIZ_WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      const w = clampQuiz(stored);
      widthRef.current = w;
      setWidth(w); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, []);

  function onResizeDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    anchorRightRef.current = asideRef.current?.getBoundingClientRect().right ?? e.clientX;
    resizingRef.current = true;
    setResizing(true);
  }
  function onResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizingRef.current) return;
    const w = clampQuiz(anchorRightRef.current - e.clientX);
    widthRef.current = w;
    setWidth(w);
  }
  function onResizeUp(e: React.PointerEvent<HTMLDivElement>) {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* 이미 해제됨 */ }
    if (!resizingRef.current) return;
    resizingRef.current = false;
    setResizing(false);
    try { localStorage.setItem(QUIZ_WIDTH_KEY, String(Math.round(widthRef.current))); } catch { /* ignore */ }
  }

  return (
    <aside ref={asideRef} style={{ width }} className="relative flex shrink-0 flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#13141b]">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("layout.splitHandle")}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        className={`absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize transition-colors ${resizing ? "bg-blue-400/60" : "hover:bg-blue-400/40"}`}
      />
      <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <div className="flex min-w-0 items-center gap-1.5">
          <IconListCheck size={15} stroke={2} aria-hidden />
          <span className="truncate">{t("quiz.title")}</span>
        </div>
        {/* 퀴즈가 하나라도 있을 때만 — 빈 상태엔 중앙에 이미 새 퀴즈 버튼이 있어 중복 방지. */}
        {quizzes.length > 0 && (
          <button
            type="button"
            onClick={addQuiz}
            title={t("quiz.newQuiz")}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <IconPlus size={13} stroke={2} aria-hidden />
            {t("quiz.newQuiz")}
          </button>
        )}
      </div>

      {/* 세션 칩바 — 여러 퀴즈 전환. 각 칩 삭제(X, 경고 모달). */}
      {quizzes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 px-3 pb-2.5 dark:border-zinc-800">
          {quizzes.map((s, i) => {
            const on = s.id === active?.id;
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-[12px] transition ${
                  on
                    ? "border-[#3B34E2] bg-[#3B34E2]/10 text-[#3B34E2] dark:border-[#8b86f5] dark:bg-[#8b86f5]/15 dark:text-[#8b86f5]"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                <button type="button" onClick={() => onQuizzesChange(quizzes, s.id)} className="cursor-pointer">
                  {t("quiz.sessionN", { n: i + 1 })}
                </button>
                <button
                  type="button"
                  onClick={() => { void deleteQuiz(s.id); }}
                  title={t("quiz.deleteQuiz")}
                  aria-label={t("quiz.deleteQuiz")}
                  className="rounded-full p-0.5 text-zinc-400 opacity-60 transition hover:bg-rose-500/10 hover:text-rose-500 hover:opacity-100"
                >
                  <IconX size={12} stroke={2.5} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="nunopi-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
        {active ? (
          <QuizRunner
            key={active.id}
            messages={messages}
            providerId={providerId}
            providerSettings={providerSettings}
            quiz={active.quiz}
            onQuizChange={updateActiveQuiz}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{t("quiz.noQuizYet")}</p>
            <button
              type="button"
              onClick={addQuiz}
              className="rounded-lg bg-[#3B34E2] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#322bc9]"
            >
              {t("quiz.newQuiz")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
