"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LearningPanel from "@/components/learning/LearningPanel";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import CodeInputArea, { type LanguageChoice } from "@/components/translator/CodeInputArea";
import TextInputArea from "@/components/translator/TextInputArea";
import EditorChatColumn from "@/components/translator/EditorChatColumn";
import ChatRoom from "@/components/learning/ChatRoom";
import ProviderToolbar from "@/components/translator/ProviderToolbar";
import { detectLanguage } from "@/lib/translator/detectLanguage";
import type { CodeToken, SupportedLanguage } from "@/lib/translator/types";
import type { AgentAnalyzeResponse, AgentProviderKind, AnalyzeMode, ChatMessage, ProviderSettings } from "@/lib/agent";
import {
  type HistoryEntry,
  saveToHistory,
  getAllHistory,
  deleteFromHistory,
  clearHistory,
  updateHistory,
} from "@/lib/historyDB";
import { loadExclusions, saveExclusions } from "@/lib/exclusions";
import { type Collection, loadCollections, saveCollections } from "@/lib/collections";

const SETTINGS_STORAGE_KEY = "nunopi:provider-settings";

type AnalyzeStreamEvent =
  | { type: "progress"; line: string }
  | { type: "partial"; providerId: AgentProviderKind; response: AgentAnalyzeResponse }
  | { type: "chunk-progress"; done: number; total: number }
  | { type: "result"; providerId: AgentProviderKind; response: AgentAnalyzeResponse }
  | { type: "error"; message: string };

interface AnalyzeApiErrorResponse {
  ok: false;
  error: {
    code:
      | "INVALID_REQUEST"
      | "PROVIDER_NOT_FOUND"
      | "PROVIDER_FAILED";
    message: string;
    providerId?: string;
  };
}

const DEFAULT_PROVIDER_ID: AgentProviderKind = "local-rules";
const DEFAULT_CODE = `const [count, setCount] = useState(0);\n\nreturn <button className="px-4 py-2">{count}</button>;`;

function generateAutoTitle(result: import("@/lib/agent").AgentAnalyzeResponse, code: string): string {
  // 1순위: 모델이 뽑은 핵심 명사구 제목. 길면 컷.
  if (result.title?.trim()) {
    const t = result.title.trim();
    return t.length > 40 ? t.slice(0, 40) + "…" : t;
  }
  // 2순위 폴백: 요약 앞부분(문장이라 핵심은 약하지만 제목 없을 때 최후).
  if (result.summary?.trim()) {
    const s = result.summary.trim();
    return s.length > 40 ? s.slice(0, 40) + "…" : s;
  }
  const firstLine = code.trim().split(/\r?\n/)[0] ?? "";
  const preview = firstLine.length > 28 ? firstLine.slice(0, 28) + "…" : firstLine;
  return `${result.language}: ${preview}`;
}

export default function Home() {
  // 분석 모드(코드/글). 모드별로 입력을 따로 유지해 토글해도 서로 안 지워지게 한다.
  const [mode, setMode] = useState<AnalyzeMode>("code");
  const [codeInput, setCodeInput] = useState(DEFAULT_CODE);
  const [textInput, setTextInput] = useState("");
  const code = mode === "text" ? textInput : codeInput;
  // 최신 입력값의 ref 미러. Monaco가 readOnly 상태에서 value를 프로그램적으로 바꿀 때
  // 쏘는 onChange는 "직전 렌더에 구독된 stale 콜백"을 호출하므로(@monaco-editor/react의
  // value-effect가 onChange 재구독 effect보다 먼저 실행), state 클로저로는 최신값 비교가
  // 안 된다. ref는 클로저와 무관해 복원 시 동기 세팅하면 stale 콜백에서도 정확히 비교된다.
  const codeInputRef = useRef(codeInput);
  const textInputRef = useRef(textInput);
  const [providerId, setProviderId] = useState<AgentProviderKind>(
    DEFAULT_PROVIDER_ID,
  );
  const [isLoading, setIsLoading] = useState(false);
  // 분석 소요시간 — 시작 시각(진행 중 실시간 타이머용) + 직전 분석 총 소요(ms, 완료 메타용).
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);
  // 멈춤으로 부분 결과만 있는 상태 — "이어서 분석" 노출 조건.
  const [resumable, setResumable] = useState(false);
  // 청크 분석 진행률(완료/전체 조각) — 막대바용. 단일 호출이면 null.
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<AgentAnalyzeResponse | null>(null);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [languageChoice, setLanguageChoice] = useState<LanguageChoice>("auto");
  // 진행 중인 분석을 멈추기 위한 AbortController 보관.
  const abortRef = useRef<AbortController | null>(null);
  // 분석 중 provider가 흘리는 최신 진행 출력 한 줄.
  const [progressLine, setProgressLine] = useState("");
  // 에디터 ↔ 학습패널 줄 링크. source로 양방향 동기화 루프를 끊는다.
  const [activeLineLink, setActiveLineLink] = useState<{
    line: number;
    source: "editor" | "panel";
  } | null>(null);
  const focusLineFromEditor = (line: number) =>
    setActiveLineLink({ line, source: "editor" });
  const focusLineFromPanel = (line: number) =>
    setActiveLineLink({ line, source: "panel" });
  // 토큰 호버/클릭으로 에디터에서 강조할 코드 줄들.
  const [markedLines, setMarkedLines] = useState<number[]>([]);
  // 제외(차단) 목록 — 글(IT 용어) 모드 전용. 코드 토큰은 X 삭제로 대체(제외 없음).
  const [excludedTerms, setExcludedTerms] = useState<string[]>([]);
  // lazy 토큰 사전 — 줄별 태그 클릭 시 on-demand로 받은 토큰은 analysisResult.tokens에
  // 직접 합쳐 유지/HTML 포함/삭제를 한 소스로 다룬다. explainingTokens는 로딩 표시용.
  const [explainingTokens, setExplainingTokens] = useState<string[]>([]);
  const [explainingConcepts, setExplainingConcepts] = useState<string[]>([]);
  // 학습 챗 — 분석(히스토리 항목)마다 스레드. chatStreaming은 타이핑 중 답변.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStreaming, setChatStreaming] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  // 사용자 목록(카테고리) — 분석결과 분류용. 정의는 localStorage, 멤버십은 HistoryEntry.collectionIds.
  const [collections, setCollections] = useState<Collection[]>([]);
  // 글 원문에서 클릭한 IT 용어 — 학습패널이 그 용어 카드로 스크롤(왼↔오 연결).
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // 드롭다운이 "자동 감지"면 기존 detectLanguage로 추론, 아니면 선택값 그대로.
  // 에디터 하이라이팅 용도 — unknown은 typescript로 폴백(스니펫 대부분 JS/TS 계열).
  const editorLanguage: SupportedLanguage = useMemo(() => {
    if (languageChoice !== "auto") return languageChoice;
    const detected = detectLanguage(code).primary;
    return detected === "unknown" ? "typescript" : detected;
  }, [code, languageChoice]);

  useEffect(() => {
    getAllHistory().then(setHistoryEntries).catch(() => {});
  }, []);

  // 입력 state → ref 미러 동기화. 편집·클리어·모드전환 등 일반 경로를 자동 커버.
  // (복원은 readOnly setValue 타이밍 탓에 핸들러에서 ref를 동기로 직접 세팅한다.)
  useEffect(() => { codeInputRef.current = codeInput; }, [codeInput]);
  useEffect(() => { textInputRef.current = textInput; }, [textInput]);

  // 현재 히스토리 항목의 result를 analysisResult와 동기화 — 태그로 불러온 토큰,
  // 개념 설명이 DB+메모리에 저장돼 다른 동작 후 돌아와도 그대로 유지된다.
  useEffect(() => {
    // 분석 중(이어서 partial 스트리밍 포함)엔 매 partial마다 DB write 하지 않는다 —
    // 완료/멈춤 시 명시적으로 저장/업데이트한다. on-demand 토큰·개념 append만 여기서 동기화.
    if (isLoading) return;
    if (!currentHistoryId || !analysisResult) return;
    const saved = analysisResult;
    updateHistory(currentHistoryId, { result: saved }).catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryEntries((prev) =>
      prev.map((e) => (e.id === currentHistoryId ? { ...e, result: saved } : e)),
    );
  }, [analysisResult, currentHistoryId, isLoading]);

  // 챗 스레드도 현재 항목에 동기화 — 다른 거 보고 돌아와도 대화 유지(#90 패턴).
  useEffect(() => {
    if (!currentHistoryId) return;
    const saved = chatMessages;
    updateHistory(currentHistoryId, { chat: saved }).catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryEntries((prev) =>
      prev.map((e) => (e.id === currentHistoryId ? { ...e, chat: saved } : e)),
    );
  }, [chatMessages, currentHistoryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExcludedTerms(loadExclusions("text"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollections(loadCollections());
  }, []);

  function handleCreateCollection(name: string): string {
    const id = crypto.randomUUID();
    setCollections((prev) => {
      const next = [...prev, { id, name, createdAt: new Date().toISOString() }];
      saveCollections(next);
      return next;
    });
    return id;
  }

  function handleDeleteCollection(id: string) {
    setCollections((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveCollections(next);
      return next;
    });
    setActiveCollectionId((cur) => (cur === id ? null : cur));
  }

  // 항목의 목록 멤버십 토글 — collectionIds 갱신(DB + 메모리, #90 패턴).
  function handleToggleEntryCollection(entryId: string, collectionId: string) {
    const entry = historyEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const current = entry.collectionIds ?? [];
    const next = current.includes(collectionId)
      ? current.filter((c) => c !== collectionId)
      : [...current, collectionId];
    updateHistory(entryId, { collectionIds: next }).catch(() => {});
    setHistoryEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, collectionIds: next } : e)),
    );
  }

  // 제외는 글(IT 용어) 모드 전용.
  function handleExclude(_targetMode: AnalyzeMode, text: string) {
    setExcludedTerms((prev) => {
      const next = prev.includes(text) ? prev : [...prev, text];
      saveExclusions("text", next);
      return next;
    });
  }

  function handleRemoveExclusion(_targetMode: AnalyzeMode, text: string) {
    setExcludedTerms((prev) => {
      const next = prev.filter((t) => t !== text);
      saveExclusions("text", next);
      return next;
    });
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setProviderSettings(JSON.parse(raw) as ProviderSettings);
    } catch { /* ignore */ }
  }, []);

  function handleSettingsSave(next: ProviderSettings) {
    setProviderSettings(next);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  useEffect(() => {
    if (isLoading) {
      document.title = "분석 중… — Nunopi";
    } else if (errorMessage) {
      document.title = "오류 — Nunopi";
    } else if (analysisResult) {
      document.title = "결과 도착 — Nunopi";
    } else {
      document.title = "Nunopi";
    }
  }, [isLoading, errorMessage, analysisResult]);

  function handleCodeChange(nextCode: string) {
    // Monaco는 value prop을 프로그램적으로 바꿔도(복원 등) onChange를 쏘고, 그 콜백은
    // stale 클로저라 state 비교는 옛 값과 비교돼 실패한다. ref로 현재 모드 입력값과 비교해
    // 무변화면 무시 — 복원이 방금 띄운 결과를 첫 클릭에 클리어하는 걸 막는다.
    // (복원은 현재 모드 항목만 대상이라 mode 변경이 없어 mode 클로저는 stale이 아니다.)
    const current = mode === "text" ? textInputRef.current : codeInputRef.current;
    if (nextCode === current) return;
    if (mode === "text") setTextInput(nextCode);
    else setCodeInput(nextCode);
    if (errorMessage) {
      setErrorMessage(null);
    }
    if (analysisResult) {
      setAnalysisResult(null);
      setExplainingTokens([]);
    setExplainingConcepts([]);
    setChatMessages([]);
    setChatStreaming(null);
    }
    // 코드가 바뀌면 이전 부분 결과 기준 "이어서"는 무효.
    setResumable(false);
    // 결과가 사라지면 상단 제목/핀 헤더도 함께 비운다(이전 분석 제목 잔존 방지).
    setCurrentHistoryId(null);
  }

  function handleModeChange(nextMode: AnalyzeMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setErrorMessage(null);
    setAnalysisResult(null);
    setCurrentHistoryId(null);
    setExplainingTokens([]);
    setExplainingConcepts([]);
    setChatMessages([]);
    setChatStreaming(null);
  }

  function handleProviderChange(nextProviderId: AgentProviderKind) {
    setProviderId(nextProviderId);
    if (errorMessage) {
      setErrorMessage(null);
    }
    if (analysisResult) {
      setAnalysisResult(null);
    }
    setCurrentHistoryId(null);
    setChatMessages([]);
    setChatStreaming(null);
  }

  // 일반 분석은 () => runAnalyze(), 이어서 분석은 runAnalyze(이전 부분 결과).
  function handleAnalyze() {
    void runAnalyze();
  }
  function handleResume() {
    if (analysisResult) void runAnalyze(analysisResult);
  }

  async function runAnalyze(resumeFrom?: AgentAnalyzeResponse) {
    const nextCode = code.trim();

    if (!nextCode) {
      setErrorMessage(
        mode === "text"
          ? "분석할 글을 먼저 입력해야 한다."
          : "분석할 코드를 먼저 입력해야 한다.",
      );
      setAnalysisResult(null);
      return;
    }

    if (isLoading) {
      return;
    }

    const startedAt = Date.now();
    setAnalysisStartedAt(startedAt);
    setLastElapsedMs(null);
    setResumable(false);
    setChunkProgress(null);
    setIsLoading(true);
    setErrorMessage(null);
    // 이어서 분석이면 기존 부분 결과·항목 id를 유지(스트리밍 누적 + 완료 시 그 항목 update).
    // 처음이면 비운다.
    if (!resumeFrom) {
      setAnalysisResult(null);
      setCurrentHistoryId(null);
    }
    setProgressLine("");
    setExplainingTokens([]);
    setExplainingConcepts([]);
    if (!resumeFrom) {
      setChatMessages([]);
      setChatStreaming(null);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // 이어서면 기존(복원/멈춤 저장) 항목을 이어 쓴다 → 완료/멈춤 시 그 항목을 update.
    // 처음이면 null로 시작해 완료 시 새로 save.
    const historyId: string | null = resumeFrom ? currentHistoryId : null;
    // 멈춤 시 저장할 최신 부분 결과(catch 클로저의 analysisResult는 stale이라 로컬로 잡는다).
    let lastPartial: AgentAnalyzeResponse | null = resumeFrom ?? null;

    try {
      const response = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId,
          request: {
            code: nextCode,
            locale: "ko",
            providerId,
            mode,
            providerSettings,
            ...(resumeFrom ? { resumeFrom } : {}),
          },
        }),
        signal: controller.signal,
      });

      // 요청 검증 실패(4xx)는 JSON 에러. 정상 요청은 NDJSON 스트림으로 응답.
      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => null)) as
          | AnalyzeApiErrorResponse
          | null;
        setAnalysisResult(null);
        setErrorMessage(result?.ok === false ? result.error.message : "분석 요청이 실패했다.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: AgentAnalyzeResponse | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: AnalyzeStreamEvent;
          try {
            event = JSON.parse(line) as AnalyzeStreamEvent;
          } catch {
            continue;
          }
          if (event.type === "progress") {
            setProgressLine(event.line);
          } else if (event.type === "partial") {
            // 청크 도착 순 점진 표시. lastPartial로 최신 부분 결과 추적(멈춤 저장용).
            lastPartial = event.response;
            setAnalysisResult(event.response);
          } else if (event.type === "chunk-progress") {
            setChunkProgress({ done: event.done, total: event.total });
          } else if (event.type === "result") {
            finalResult = event.response;
          } else if (event.type === "error") {
            streamError = event.message;
          }
        }
      }

      if (streamError) {
        setAnalysisResult(null);
        setErrorMessage(streamError);
        return;
      }

      if (finalResult) {
        const saved = finalResult;
        setLastElapsedMs(Date.now() - startedAt);
        setResumable(false);
        setAnalysisResult(saved);
        if (historyId) {
          // 이어서/복원 항목 완성 → 같은 항목 업데이트(incomplete 해제, 제목 보존).
          const id = historyId;
          updateHistory(id, { result: saved, incomplete: false }).catch(() => {});
          setHistoryEntries((prev) =>
            prev.map((e) => (e.id === id ? { ...e, result: saved, incomplete: false } : e)),
          );
        } else {
          saveToHistory({
            code: nextCode,
            providerId,
            mode,
            result: saved,
            incomplete: false,
            title: generateAutoTitle(saved, nextCode),
            createdAt: new Date().toISOString(),
          }).then((savedId) => {
            setCurrentHistoryId(savedId);
            return getAllHistory();
          }).then(setHistoryEntries).catch(() => {});
        }
      }
    } catch (error) {
      // 유저가 멈추기를 누른 경우 — 부분 결과를 지우지 않고 그대로 둔다 + 히스토리에 미완 저장.
      // 부분 결과가 있으면 "이어서 분석" 가능(render에서 analysisResult와 함께 게이트).
      if (error instanceof DOMException && error.name === "AbortError") {
        setResumable(true);
        if (lastPartial) {
          const partial = lastPartial;
          if (historyId) {
            const id = historyId;
            updateHistory(id, { result: partial, incomplete: true }).catch(() => {});
            setHistoryEntries((prev) =>
              prev.map((e) => (e.id === id ? { ...e, result: partial, incomplete: true } : e)),
            );
          } else {
            saveToHistory({
              code: nextCode,
              providerId,
              mode,
              result: partial,
              incomplete: true,
              title: generateAutoTitle(partial, nextCode),
              createdAt: new Date().toISOString(),
            }).then((savedId) => {
              setCurrentHistoryId(savedId);
              return getAllHistory();
            }).then(setHistoryEntries).catch(() => {});
          }
        }
      } else {
        setAnalysisResult(null);
        setErrorMessage(formatFetchError(error));
      }
    } finally {
      abortRef.current = null;
      setAnalysisStartedAt(null);
      setChunkProgress(null);
      setProgressLine("");
      setIsLoading(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleTokenExplain(tokenText: string, line: number) {
    if (
      explainingTokens.includes(tokenText) ||
      analysisResult?.tokens.some((t) => t.token === tokenText)
    ) {
      return;
    }
    const input = code.trim();
    if (!input) return;
    setExplainingTokens((prev) => [...prev, tokenText]);
    (async () => {
      try {
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            request: {
              code: input,
              locale: "ko",
              providerId,
              mode: "explain-token",
              targetToken: tokenText,
              providerSettings,
            },
          }),
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let token: CodeToken | undefined;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.trim()) continue;
            try {
              const event = JSON.parse(l) as AnalyzeStreamEvent;
              if (event.type === "result") token = event.response.tokens?.[0];
            } catch { /* skip */ }
          }
        }
        if (token) {
          const resolved: CodeToken = { ...token, id: tokenText, token: tokenText, lines: [line] };
          // 받아온 토큰을 결과에 합쳐 유지(HTML 저장에도 포함, 삭제는 result에서 제거).
          setAnalysisResult((prev) =>
            prev && !prev.tokens.some((t) => t.token === tokenText)
              ? { ...prev, tokens: [...prev.tokens, resolved] }
              : prev,
          );
        }
      } catch { /* ignore — on-demand explain failure is non-fatal */ } finally {
        setExplainingTokens((prev) => prev.filter((t) => t !== tokenText));
      }
    })();
  }

  function handleDeleteToken(tokenText: string) {
    setAnalysisResult((prev) =>
      prev ? { ...prev, tokens: prev.tokens.filter((t) => t.token !== tokenText) } : prev,
    );
  }

  function handleSendChat(text: string) {
    if (chatLoading) return;
    const input = code.trim();
    const next: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(next);
    setChatStreaming("");
    setChatLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            request: {
              code: input || "(코드 없음)",
              locale: "ko",
              providerId,
              mode: "chat",
              messages: next,
              providerSettings,
            },
          }),
        });
        if (!res.ok || !res.body) {
          setChatMessages([...next, { role: "assistant", content: "답변 요청이 실패했다." }]);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.trim()) continue;
            try {
              const event = JSON.parse(l) as AnalyzeStreamEvent;
              // codex는 진행 라벨만 흘리므로 타이핑에 안 씀(claude/openai만 전체 답 스트림).
              if (event.type === "progress" && providerId !== "codex-agent") {
                setChatStreaming(event.line);
              } else if (event.type === "result") {
                answer = event.response.summary;
              }
            } catch { /* skip */ }
          }
        }
        setChatMessages([...next, { role: "assistant", content: answer || "(빈 응답)" }]);
      } catch {
        setChatMessages([...next, { role: "assistant", content: "답변 중 오류가 발생했다." }]);
      } finally {
        setChatStreaming(null);
        setChatLoading(false);
      }
    })();
  }

  function handleClearChat() {
    setChatMessages([]);
    setChatStreaming(null);
    // 빈 배열은 [chatMessages] 동기화 effect가 현재 항목 DB/메모리에 반영한다.
  }

  // 입력 잠금(분석 결과 있을 때) 해제 — 입력을 비우고 깨끗한 새 분석 상태로.
  function handleClearInput() {
    if (mode === "text") setTextInput("");
    else setCodeInput("");
    setAnalysisResult(null);
    setErrorMessage(null);
    setCurrentHistoryId(null);
    setChatMessages([]);
    setChatStreaming(null);
    setExplainingTokens([]);
    setExplainingConcepts([]);
    setActiveLineLink(null);
    setMarkedLines([]);
    setActiveTermId(null);
  }

  function handleDeleteConcept(conceptId: string) {
    setAnalysisResult((prev) =>
      prev ? { ...prev, concepts: prev.concepts.filter((c) => c.conceptId !== conceptId) } : prev,
    );
  }

  function handleConceptExplain(conceptId: string, title: string) {
    if (
      explainingConcepts.includes(conceptId) ||
      analysisResult?.concepts.some((c) => c.conceptId === conceptId && c.description)
    ) {
      return;
    }
    const input = code.trim();
    if (!input) return;
    setExplainingConcepts((prev) => [...prev, conceptId]);
    (async () => {
      try {
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            request: {
              code: input,
              locale: "ko",
              providerId,
              mode: "explain-concept",
              targetConcept: title,
              providerSettings,
            },
          }),
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let description: string | undefined;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.trim()) continue;
            try {
              const event = JSON.parse(l) as AnalyzeStreamEvent;
              if (event.type === "result") description = event.response.concepts?.[0]?.description;
            } catch { /* skip */ }
          }
        }
        if (description) {
          const desc = description;
          setAnalysisResult((prev) =>
            prev
              ? {
                  ...prev,
                  concepts: prev.concepts.map((c) =>
                    c.conceptId === conceptId ? { ...c, description: desc } : c,
                  ),
                }
              : prev,
          );
        }
      } catch { /* ignore — on-demand explain failure is non-fatal */ } finally {
        setExplainingConcepts((prev) => prev.filter((x) => x !== conceptId));
      }
    })();
  }

  function handleRestoreHistory(entry: HistoryEntry) {
    const entryMode = entry.mode ?? "code";
    // 복원 결과는 일회성 소요시간 표시 대상이 아니다 — stale 표시 방지.
    setLastElapsedMs(null);
    // 미완(멈춤) 항목이면 "이어서 분석" 가능.
    setResumable(Boolean(entry.incomplete));
    setMode(entryMode);
    setExplainingTokens([]);
    setExplainingConcepts([]);
    setChatStreaming(null);
    setChatMessages(entry.chat ?? []);
    // ref를 동기로 먼저 세팅 — 복원 직후 입력이 locked(readOnly)가 되고, Monaco가 그
    // 상태에서 setValue로 쏘는 onChange(stale 콜백)가 결과를 클리어하지 못하게 한다.
    if (entryMode === "text") { textInputRef.current = entry.code; setTextInput(entry.code); }
    else { codeInputRef.current = entry.code; setCodeInput(entry.code); }
    setProviderId(entry.providerId);
    setAnalysisResult(entry.result);
    setErrorMessage(null);
    // 복원한 항목을 현재 결과로 지정 → 상단 제목/핀 헤더가 그 항목 기준으로 표시된다.
    setCurrentHistoryId(entry.id);
  }

  function handleDeleteHistory(id: string) {
    deleteFromHistory(id).then(() => getAllHistory()).then(setHistoryEntries).catch(() => {});
  }

  function handleClearHistory() {
    // 현재 모드의 히스토리만 삭제하고 목록을 다시 읽어 다른 모드 항목은 보존한다.
    clearHistory(mode).then(() => getAllHistory()).then(setHistoryEntries).catch(() => {});
  }

  function handleUpdateHistory(
    id: string,
    changes: Partial<Pick<import("@/lib/historyDB").HistoryEntry, "isPinned" | "title">>,
  ) {
    updateHistory(id, changes)
      .then(() => getAllHistory())
      .then(setHistoryEntries)
      .catch(() => {});
  }

  return (
    <>
      <AppShell
        toolbar={
          <ProviderToolbar
            mode={mode}
            providerId={providerId}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onModeChange={handleModeChange}
            onProviderChange={handleProviderChange}
            onAnalyze={handleAnalyze}
            onCancel={handleCancel}
            onSettingsOpen={() => setIsSettingsOpen(true)}
            resumable={resumable && analysisResult != null}
            onResume={handleResume}
          />
        }
        learningPanel={
        <LearningPanel
          providerId={providerId}
          mode={mode}
          isLoading={isLoading}
          progressLine={progressLine}
          analysisStartedAt={analysisStartedAt}
          elapsedMs={lastElapsedMs}
          chunkProgress={chunkProgress}
          errorMessage={errorMessage}
          result={analysisResult}
          code={code}
          activeTermId={activeTermId}
          activeLine={activeLineLink?.line ?? null}
          activeLineSource={activeLineLink?.source}
          onLineFocus={focusLineFromPanel}
          onMarkLines={setMarkedLines}
          excludedTerms={excludedTerms}
          onExclude={handleExclude}
          onDeleteToken={handleDeleteToken}
          onConceptExplain={handleConceptExplain}
          onDeleteConcept={handleDeleteConcept}
          explainingTokens={explainingTokens}
          explainingConcepts={explainingConcepts}
          onTokenExplain={handleTokenExplain}
          historyEntries={historyEntries}
          onRestoreHistory={handleRestoreHistory}
          onDeleteHistory={handleDeleteHistory}
          onClearHistory={handleClearHistory}
          onUpdateHistory={handleUpdateHistory}
          currentHistoryId={currentHistoryId}
          currentHistoryTitle={historyEntries.find(e => e.id === currentHistoryId)?.title}
          currentHistoryIsPinned={historyEntries.find(e => e.id === currentHistoryId)?.isPinned ?? false}
          onSetCurrentTitle={(title) => { if (currentHistoryId) handleUpdateHistory(currentHistoryId, { title: title || undefined }); }}
          onToggleCurrentPin={() => {
            const entry = historyEntries.find(e => e.id === currentHistoryId);
            if (currentHistoryId && entry) handleUpdateHistory(currentHistoryId, { isPinned: !entry.isPinned });
          }}
          collections={collections}
          activeCollectionId={activeCollectionId}
          onSelectCollection={setActiveCollectionId}
          onCreateCollection={handleCreateCollection}
          onDeleteCollection={handleDeleteCollection}
          onToggleEntryCollection={handleToggleEntryCollection}
        />
      }
        editor={
          <EditorChatColumn
            chatOpen={chatOpen}
            editor={
              mode === "text" ? (
                <TextInputArea
                  code={code}
                  isLoading={isLoading}
                  onCodeChange={handleCodeChange}
                  chatOpen={chatOpen}
                  onToggleChat={() => setChatOpen((v) => !v)}
                  locked={analysisResult != null}
                  onClear={handleClearInput}
                  terms={analysisResult?.terms ?? []}
                  onTermClick={setActiveTermId}
                />
              ) : (
                <CodeInputArea
                  code={code}
                  isLoading={isLoading}
                  languageChoice={languageChoice}
                  editorLanguage={editorLanguage}
                  onLanguageChoiceChange={setLanguageChoice}
                  onCodeChange={handleCodeChange}
                  activeLine={activeLineLink?.line ?? null}
                  onLineClick={focusLineFromEditor}
                  markedLines={markedLines}
                  chatOpen={chatOpen}
                  onToggleChat={() => setChatOpen((v) => !v)}
                  locked={analysisResult != null}
                  onClear={handleClearInput}
                />
              )
            }
            chat={
              <ChatRoom
                messages={chatMessages}
                streaming={chatStreaming}
                isLoading={chatLoading}
                disabled={!code.trim()}
                disabledHint={mode === "text" ? "글을 입력하면 질문할 수 있어요." : "코드를 입력하면 질문할 수 있어요."}
                onSend={handleSendChat}
                onClear={handleClearChat}
              />
            }
          />
        }
      />
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={providerSettings}
        onSave={handleSettingsSave}
        excludedTerms={excludedTerms}
        onRemoveExclusion={handleRemoveExclusion}
      />
    </>
  );
}

function formatFetchError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "분석 요청 중 알 수 없는 오류가 발생했다.";
}
