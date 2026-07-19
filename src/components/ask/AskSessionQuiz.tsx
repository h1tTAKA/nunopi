"use client";

import { useEffect, useRef, useState } from "react";
import { IconListCheck, IconRefresh, IconCheck, IconX, IconLoader2 } from "@tabler/icons-react";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import type { AgentProviderKind, ChatMessage, ProviderSettings } from "@/lib/agent";
// 퀴즈 저장 스키마의 주인은 store — 타입을 여기서 가져온다(#542 영속).
import type { QuizQuestion as QuizQ, QuizGraded as Graded, AskQuiz } from "@/lib/askStore";

// Ask 아웃풋 퀴즈 패널 — 현재 서브(탭)의 Q&A를 재료로 능동 회상 퀴즈 생성→풀기→채점.
// 에이전트 mode:"quiz" 1개로 생성(GENERATE)·채점(GRADE) 겸용. 출력은 ```json 블록, 클라가 파싱.
// 상태는 store(AskSub.quiz)에 저장돼 탭 전환/재진입에도 유지(#542).

// 화면 단계 — 진행 중(loading/grading)·error 포함. 저장은 안정 단계(idle/solving/done)만.
type Phase = "idle" | "loading" | "solving" | "grading" | "done" | "error";

const LANG_NAME: Record<string, string> = { ko: "한국어", ja: "日本語", en: "English" };

// 패널 폭(px) — 드래그로 조절, localStorage 영속. 우측 패널이라 왼쪽 모서리를 잡아 늘린다.
const QUIZ_MIN = 280;
const QUIZ_MAX = 560;
const QUIZ_DEFAULT = 320;
const QUIZ_WIDTH_KEY = "nunopi.ask.quizWidth";
const clampQuiz = (w: number) => Math.min(QUIZ_MAX, Math.max(QUIZ_MIN, w));

// 서브 대화(Q&A)를 퀴즈 생성 컨텍스트로 — 첫 줄 MODE로 프롬프트가 분기한다.
function buildGenerateContext(messages: ChatMessage[], langName: string): string {
  const qa = messages
    .map((m) => `${m.role === "user" ? "Q" : "A"}: ${m.content}`)
    .join("\n\n");
  return [
    "MODE: GENERATE",
    `LANGUAGE: ${langName} (모든 문제·선택지·해설은 이 언어로)`,
    "",
    "아래는 학습자가 실제로 물어본 질문과 받은 답이다. 이걸 바탕으로 능동 회상용 퀴즈를 만든다.",
    "규칙:",
    "- 문제 3~6개. 유형을 섞는다: mc(4지선다) / short(주관식 한두 문장) / reverse(역질문 — \"왜 이렇게 했게?\" 같이 이유·원리를 묻기).",
    "- 학습자가 실제로 물어본 내용에서만 출제(모르는 걸 새로 묻지 않기).",
    '- type은 반드시 "mc" | "short" | "reverse" 중 하나 그대로(다른 표기 금지: "multiple_choice" X).',
    '- mc의 answer는 정답 옵션의 0-based 인덱스 숫자(0,1,2,3). 글자("A")나 정답 텍스트가 아니라 숫자.',
    "- 오직 ```json 펜스 블록 하나만 출력. 배열의 각 원소:",
    '  { "type": "mc", "q": "...", "options": ["A","B","C","D"], "answer": 정답인덱스(0-3), "why": "정답 이유 한 줄" }',
    '  { "type": "short", "q": "...", "answer": "모범답안", "why": "채점 포인트 한 줄" }',
    '  { "type": "reverse", "q": "...", "answer": "모범답안", "why": "채점 포인트 한 줄" }',
    "",
    "=== 학습자 Q&A ===",
    qa,
  ].join("\n");
}

// 주관식/역질문 채점 컨텍스트 — 문제·모범답안·학습자 답을 주고 항목별 판정을 받는다.
function buildGradeContext(
  items: { q: string; model: string; user: string }[],
  langName: string,
): string {
  const body = items
    .map(
      (it, i) =>
        `[${i}]\n문제: ${it.q}\n모범답안: ${it.model}\n학습자 답: ${it.user || "(무응답)"}`,
    )
    .join("\n\n");
  return [
    "MODE: GRADE",
    `LANGUAGE: ${langName} (피드백은 이 언어로)`,
    "",
    "아래 각 항목에서 학습자 답이 모범답안의 핵심을 담았는지 판정한다. 표현이 달라도 요지가 맞으면 정답.",
    "오직 ```json 펜스 블록 하나만 출력. 배열 길이는 항목 수와 같고 순서 동일. 각 원소:",
    '  { "correct": true/false, "feedback": "짧고 따뜻한 교정 한두 문장" }',
    "",
    "=== 채점 항목 ===",
    body,
  ].join("\n");
}

// ```json ... ``` 안 JSON을 관대하게 파싱. 펜스 없으면 첫 [ ~ 마지막 ] 슬라이스.
function parseJsonBlock<T>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  try {
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}

// 모델이 흘리는 type 표기 흔들림 흡수 — "multiple_choice"·"subjective" 등도 우리 3종으로.
const TYPE_ALIASES: Record<string, QuizQ["type"]> = {
  mc: "mc", multiple_choice: "mc", "multiple-choice": "mc", multiplechoice: "mc", choice: "mc", objective: "mc",
  short: "short", short_answer: "short", shortanswer: "short", subjective: "short", written: "short",
  reverse: "reverse", reverse_question: "reverse", reversequestion: "reverse",
};

// mc 정답을 0-based 숫자 인덱스로 강제 — 숫자·글자("A")·정답텍스트 뭐가 와도 흡수.
// 옵션 범위 밖(예: 옵션 3개인데 "D"→3)이면 -1(오답 처리되되 렌더는 됨).
function coerceMcAnswer(a: unknown, options: string[]): number {
  let idx = -1;
  if (typeof a === "number" && Number.isInteger(a)) idx = a;
  else if (typeof a === "string") {
    const s = a.trim();
    if (/^[A-Za-z]$/.test(s)) idx = s.toUpperCase().charCodeAt(0) - 65; // "A"→0
    else if (/^\d+$/.test(s)) idx = parseInt(s, 10);
    else idx = options.findIndex((o) => o === s);
  }
  return idx >= 0 && idx < options.length ? idx : -1; // 범위 밖은 무효 처리
}

// LLM 원소 하나를 우리 QuizQ 모양으로 정규화(키·타입 흔들림 흡수). 못 살리면 null.
function normalizeQuestion(raw: unknown): QuizQ | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const q = typeof r.q === "string" ? r.q : typeof r.question === "string" ? r.question : "";
  if (!q.trim()) return null;
  const opts = Array.isArray(r.options) ? r.options.map((o) => String(o)) : [];
  const type = TYPE_ALIASES[String(r.type ?? "").toLowerCase()] ?? (opts.length ? "mc" : "short");
  const why = typeof r.why === "string" ? r.why : undefined;
  if (type === "mc") return { type, q, options: opts, answer: coerceMcAnswer(r.answer, opts), why };
  return { type, q, answer: typeof r.answer === "string" ? r.answer : String(r.answer ?? ""), why };
}

// 채점 결과 한 항목 정규화 — correct(불리언/"true"/1)·feedback(feedback/comment) 흔들림 흡수. 못 살리면 null.
function coerceVerdict(raw: unknown): Graded | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const c = r.correct;
  const correct = c === true || c === "true" || c === 1 || c === "1" || c === "correct" || c === "O";
  const wrong = c === false || c === "false" || c === 0 || c === "0" || c === "X";
  if (!correct && !wrong && typeof c !== "boolean") return null; // 판정 필드 못 찾음
  const feedback = typeof r.feedback === "string" ? r.feedback : typeof r.comment === "string" ? r.comment : undefined;
  return { correct, feedback };
}

// mode:"quiz" 호출 — 스트리밍 result 이벤트의 summary(블록)를 모아 반환.
async function runQuiz(
  context: string,
  opts: { providerId: AgentProviderKind; providerSettings: ProviderSettings; locale: "ko" | "ja" | "en"; signal: AbortSignal },
): Promise<string> {
  const res = await fetch("/api/agent/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId: opts.providerId,
      request: { code: context, locale: opts.locale, providerId: opts.providerId, mode: "quiz", providerSettings: opts.providerSettings },
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  const take = (line: string) => {
    try {
      const ev = JSON.parse(line) as { type: string; response?: { summary: string } };
      if (ev.type === "result" && ev.response) out = ev.response.summary;
    } catch { /* 부분 청크 무시 */ }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) take(l);
  }
  if (buffer.trim()) take(buffer);
  return out;
}

export default function AskSessionQuiz({ messages, providerId, providerSettings, quiz, onQuizChange }: {
  messages: ChatMessage[];
  providerId: AgentProviderKind;
  providerSettings: ProviderSettings;
  quiz?: AskQuiz; // 저장된 퀴즈(있으면 이걸로 초기화 — 탭 재진입 복원).
  onQuizChange: (next: AskQuiz | undefined) => void; // 상태 바뀔 때 store에 저장.
}) {
  const t = useT();
  const { locale } = useLocale();
  // 초기값을 저장된 quiz에서 복원(useState 초기화 함수 — 최초 마운트 1회만 읽음).
  const [phase, setPhase] = useState<Phase>(() => quiz?.phase ?? "idle");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQ[]>(() => quiz?.questions ?? []);
  // 답: mc=옵션 인덱스(number), short/reverse=문자열.
  const [answers, setAnswers] = useState<Record<number, number | string>>(() => quiz?.answers ?? {});
  const [graded, setGraded] = useState<Record<number, Graded>>(() => quiz?.graded ?? {});

  // 최신 저장 콜백을 ref로 — 부모가 매 렌더 새 함수를 줘도 저장 effect가 재실행되지 않게(deps 제외).
  // 렌더 중이 아니라 커밋 후(effect)에 갱신(react-hooks/refs).
  const onQuizChangeRef = useRef(onQuizChange);
  useEffect(() => { onQuizChangeRef.current = onQuizChange; });

  // 상태가 바뀌면 store에 저장(탭 전환/재진입 유지). 진행 중(loading/grading)·error는 안정 단계로 눕혀 저장.
  useEffect(() => {
    if (questions.length === 0) { onQuizChangeRef.current(undefined); return; }
    const savedPhase: AskQuiz["phase"] = phase === "done" ? "done" : "solving";
    onQuizChangeRef.current({ phase: savedPhase, questions, answers, graded });
  }, [phase, questions, answers, graded]);

  // 패널 폭 리사이즈 — 우측 패널이라 왼쪽 모서리 핸들을 잡고 왼쪽으로 끌면 넓어진다.
  const [width, setWidth] = useState(QUIZ_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const resizingRef = useRef(false);
  const widthRef = useRef(QUIZ_DEFAULT);
  const asideRef = useRef<HTMLElement>(null);
  // 드래그 중 고정된 기준점 = 패널 오른쪽 모서리 x좌표. 폭 = 기준점 - 현재 커서 x.
  const anchorRightRef = useRef(0);
  // 진행 중 요청 — 재생성/언마운트 시 이전 요청을 끊어 언마운트 후 setState·낭비 요청을 막는다.
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => () => acRef.current?.abort(), []);

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

  const langName = LANG_NAME[locale] ?? "English";
  const hasMaterial = messages.some((m) => m.role === "assistant");

  async function generate() {
    setPhase("loading");
    setError(null);
    setAnswers({});
    setGraded({});
    acRef.current?.abort(); // 이전 진행 요청 취소
    const ac = new AbortController();
    acRef.current = ac;
    try {
      const text = await runQuiz(buildGenerateContext(messages, langName), { providerId, providerSettings, locale, signal: ac.signal });
      if (ac.signal.aborted) return; // 취소됐으면(언마운트/재생성) 아무것도 안 씀
      const parsed = parseJsonBlock<unknown[]>(text);
      const clean = (Array.isArray(parsed) ? parsed : []).map(normalizeQuestion).filter((q): q is QuizQ => q !== null);
      if (clean.length === 0) { setPhase("error"); setError(t("quiz.genFailed")); return; }
      setQuestions(clean);
      setPhase("solving");
    } catch {
      if (ac.signal.aborted) return;
      setPhase("error");
      setError(t("quiz.genFailed"));
    }
  }

  async function submit() {
    // 객관식은 즉시 클라 채점.
    const next: Record<number, Graded> = {};
    const toGrade: { idx: number; q: string; model: string; user: string }[] = [];
    questions.forEach((q, i) => {
      if (q.type === "mc") {
        next[i] = { correct: answers[i] === q.answer };
      } else {
        toGrade.push({ idx: i, q: q.q, model: String(q.answer ?? ""), user: String(answers[i] ?? "") });
      }
    });
    if (toGrade.length === 0) { setGraded(next); setPhase("done"); return; }
    // 주관식/역질문은 에이전트 채점(2차 라운드).
    setPhase("grading");
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    try {
      const text = await runQuiz(
        buildGradeContext(toGrade.map((x) => ({ q: x.q, model: x.model, user: x.user })), langName),
        { providerId, providerSettings, locale, signal: ac.signal },
      );
      if (ac.signal.aborted) return;
      const verdicts = parseJsonBlock<Record<string, unknown>[]>(text) ?? [];
      toGrade.forEach((x, j) => {
        next[x.idx] = coerceVerdict(verdicts[j]) ?? { correct: false, feedback: t("quiz.gradeFailed") };
      });
      setGraded(next);
      setPhase("done");
    } catch {
      if (ac.signal.aborted) return;
      // 채점 실패해도 객관식 결과는 보여준다.
      toGrade.forEach((x) => { next[x.idx] = { correct: false, feedback: t("quiz.gradeFailed") }; });
      setGraded(next);
      setPhase("done");
    }
  }

  const score = questions.reduce((n, _q, i) => n + (graded[i]?.correct ? 1 : 0), 0);
  const answeredAll = questions.every((q, i) => (q.type === "mc" ? typeof answers[i] === "number" : String(answers[i] ?? "").trim().length > 0));

  return (
    <aside ref={asideRef} style={{ width }} className="relative flex shrink-0 flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#13141b]">
      {/* 폭 조절 핸들 — 왼쪽 모서리. 잡고 왼쪽으로 끌면 패널이 넓어진다. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("layout.splitHandle")}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        className={`absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize transition-colors ${
          resizing ? "bg-blue-400/60" : "hover:bg-blue-400/40"
        }`}
      />
      <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <div className="flex min-w-0 items-center gap-1.5">
          <IconListCheck size={15} stroke={2} aria-hidden />
          <span className="truncate">{t("quiz.title")}</span>
        </div>
        {(phase === "solving" || phase === "done" || phase === "error") && (
          <button
            type="button"
            onClick={() => { setPhase("idle"); setQuestions([]); setAnswers({}); setGraded({}); setError(null); }}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <IconRefresh size={13} stroke={2} aria-hidden />
            {t("quiz.retry")}
          </button>
        )}
      </div>

      <div className="nunopi-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {/* 시작 전 / 로딩 / 에러 */}
        {phase === "idle" && (
          <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{hasMaterial ? t("quiz.intro") : t("quiz.needMaterial")}</p>
            <button
              type="button"
              disabled={!hasMaterial}
              onClick={() => { void generate(); }}
              className="rounded-lg bg-[#3B34E2] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#2f28c4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#8b86f5] dark:hover:bg-[#7a74e8]"
            >
              {t("quiz.make")}
            </button>
          </div>
        )}
        {(phase === "loading" || phase === "grading") && (
          <div className="flex flex-col items-center gap-2 px-2 py-10 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
            <IconLoader2 size={22} stroke={2} className="animate-spin" aria-hidden />
            {t(phase === "loading" ? "quiz.making" : "quiz.gradingNow")}
          </div>
        )}
        {phase === "error" && (
          <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
            <p className="text-[13px] text-rose-500">{error}</p>
            <button type="button" onClick={() => { void generate(); }} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[13px] text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              {t("quiz.retry")}
            </button>
          </div>
        )}

        {/* 문제 목록 (풀기 / 결과) */}
        {(phase === "solving" || phase === "done" || phase === "grading") && questions.map((q, i) => {
          const g = graded[i];
          const showResult = phase === "done" && !!g;
          return (
            <div key={i} className="mb-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-1.5 flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase text-[#3B34E2] dark:text-[#8b86f5]">{t(`quiz.type.${q.type}`)}</span>
                <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{q.q}</p>
                {showResult && (g.correct
                  ? <IconCheck size={16} stroke={2.5} className="ml-auto shrink-0 text-emerald-500" aria-hidden />
                  : <IconX size={16} stroke={2.5} className="ml-auto shrink-0 text-rose-500" aria-hidden />)}
              </div>

              {q.type === "mc" && q.options ? (
                <div className="flex flex-col gap-1">
                  {q.options.map((opt, oi) => {
                    const picked = answers[i] === oi;
                    const isAnswer = showResult && oi === q.answer;
                    return (
                      <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition ${
                        isAnswer ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
                        : picked ? "border-[#3B34E2] bg-[#3B34E2]/5 dark:border-[#8b86f5]"
                        : "border-zinc-200 dark:border-zinc-800"} ${showResult ? "cursor-default" : ""}`}>
                        <input type="radio" name={`q${i}`} checked={picked} disabled={showResult} onChange={() => setAnswers((a) => ({ ...a, [i]: oi }))} className="accent-[#3B34E2]" />
                        <span className="text-zinc-700 dark:text-zinc-200">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={String(answers[i] ?? "")}
                  disabled={showResult}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  rows={2}
                  placeholder={t("quiz.answerPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] text-zinc-700 outline-none focus:border-[#3B34E2] disabled:opacity-70 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                />
              )}

              {showResult && (
                <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 text-[11px] dark:border-zinc-800">
                  {q.type !== "mc" && (
                    <p className="text-zinc-500 dark:text-zinc-400"><span className="font-semibold">{t("quiz.modelAnswer")}:</span> {String(q.answer)}</p>
                  )}
                  {g.feedback && <p className="text-zinc-600 dark:text-zinc-300">{g.feedback}</p>}
                  {q.why && <p className="text-zinc-400 dark:text-zinc-500">{q.why}</p>}
                </div>
              )}
            </div>
          );
        })}

        {phase === "solving" && questions.length > 0 && (
          <button
            type="button"
            disabled={!answeredAll}
            onClick={() => { void submit(); }}
            className="mt-1 w-full rounded-lg bg-[#3B34E2] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#2f28c4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#8b86f5] dark:hover:bg-[#7a74e8]"
          >
            {t("quiz.submit")}
          </button>
        )}

        {phase === "done" && (
          <div className="mt-1 rounded-lg bg-[#3B34E2]/5 px-3 py-2.5 text-center text-[13px] font-semibold text-[#3B34E2] dark:bg-[#8b86f5]/10 dark:text-[#8b86f5]">
            {t("quiz.score")}: {score} / {questions.length}
          </div>
        )}
      </div>
    </aside>
  );
}
