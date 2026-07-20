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
  const active = quizzes.find((q) => q.id === activeQuizId) ?? quizzes[quizzes.length - 1];
  // 초안(composing) = 옵션 고르는 새 퀴즈 화면. 아직 세션 아님(생성돼야 칩에 등록). 퀴즈 0개면 항상 초안.
  const [composing, setComposing] = useState(false);
  const showDraft = composing || quizzes.length === 0;
  // 초안 1회당 세션 1개만 만들도록 가드(생성 시 questions·phase 두 setState가 각각 콜백 부를 수 있음).
  // 새 초안이 열릴 때(showDraft→true)마다 리셋.
  const draftCommittedRef = useRef(false);
  useEffect(() => { if (showDraft) draftCommittedRef.current = false; }, [showDraft]);

  // ── 세션 조작 ──────────────────────────────
  function newDraft() { setComposing(true); }          // + 새 퀴즈 = 초안 화면 열기(세션 생성은 생성 시점에)
  function selectQuiz(id: string) { setComposing(false); onQuizzesChange(quizzes, id); }
  // 초안에서 생성 성공(문제 생김) 시에만 세션으로 등록. 빈 상태(undefined/문제 0)는 무시. 중복 등록 가드.
  function onDraftChange(next: AskQuiz | undefined) {
    if (!next || next.questions.length === 0) return;
    if (draftCommittedRef.current) return;
    draftCommittedRef.current = true;
    const session: QuizSession = { id: newAskId(), createdAt: new Date().toISOString(), quiz: next };
    onQuizzesChange([...quizzes, session], session.id);
    setComposing(false);
  }
  // 기존 활성 세션 갱신(QuizRunner가 풀이/채점 중 호출). undefined면 빈 idle로(세션 유지).
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
        {/* 퀴즈가 있고 초안 중이 아닐 때만 — 초안(생성 전)엔 이미 옵션 화면이라 중복 방지. */}
        {quizzes.length > 0 && !showDraft && (
          <button
            type="button"
            onClick={newDraft}
            title={t("quiz.newQuiz")}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <IconPlus size={13} stroke={2} aria-hidden />
            {t("quiz.newQuiz")}
          </button>
        )}
      </div>

      {/* 세션 칩바 — 생성된 퀴즈만(초안 제외) 전환. 각 칩 삭제(X, 경고 모달). */}
      {quizzes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 px-3 pb-2.5 dark:border-zinc-800">
          {quizzes.map((s, i) => {
            const on = !showDraft && s.id === active?.id;
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-[12px] transition ${
                  on
                    ? "border-[#3B34E2] bg-[#3B34E2]/10 text-[#3B34E2] dark:border-[#8b86f5] dark:bg-[#8b86f5]/15 dark:text-[#8b86f5]"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                <button type="button" onClick={() => selectQuiz(s.id)} className="cursor-pointer">
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
        {showDraft ? (
          // 초안: 빈 QuizRunner(옵션 화면). 생성 성공 시 onDraftChange가 세션으로 등록.
          <QuizRunner
            key="draft"
            messages={messages}
            providerId={providerId}
            providerSettings={providerSettings}
            quiz={undefined}
            onQuizChange={onDraftChange}
          />
        ) : active ? (
          <QuizRunner
            key={active.id}
            messages={messages}
            providerId={providerId}
            providerSettings={providerSettings}
            quiz={active.quiz}
            onQuizChange={updateActiveQuiz}
          />
        ) : null}
      </div>
    </aside>
  );
}
