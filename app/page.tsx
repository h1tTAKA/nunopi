"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LearningPanel from "@/components/learning/LearningPanel";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import CodeInputArea, { type LanguageChoice } from "@/components/translator/CodeInputArea";
import ProviderToolbar from "@/components/translator/ProviderToolbar";
import { detectLanguage } from "@/lib/translator/detectLanguage";
import type { SupportedLanguage } from "@/lib/translator/types";
import type { AgentAnalyzeResponse, AgentProviderKind, ProviderSettings } from "@/lib/agent";
import {
  type HistoryEntry,
  saveToHistory,
  getAllHistory,
  deleteFromHistory,
  clearHistory,
  updateHistory,
} from "@/lib/historyDB";

const SETTINGS_STORAGE_KEY = "nunopi:provider-settings";

type AnalyzeStreamEvent =
  | { type: "progress"; line: string }
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
  if (result.summary?.trim()) {
    const s = result.summary.trim();
    return s.length > 40 ? s.slice(0, 40) + "…" : s;
  }
  const firstLine = code.trim().split(/\r?\n/)[0] ?? "";
  const preview = firstLine.length > 28 ? firstLine.slice(0, 28) + "…" : firstLine;
  return `${result.language}: ${preview}`;
}

export default function Home() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [providerId, setProviderId] = useState<AgentProviderKind>(
    DEFAULT_PROVIDER_ID,
  );
  const [isLoading, setIsLoading] = useState(false);
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
    setCode(nextCode);
    if (errorMessage) {
      setErrorMessage(null);
    }
    if (analysisResult) {
      setAnalysisResult(null);
    }
    // 결과가 사라지면 상단 제목/핀 헤더도 함께 비운다(이전 분석 제목 잔존 방지).
    setCurrentHistoryId(null);
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
  }

  async function handleAnalyze() {
    const nextCode = code.trim();

    if (!nextCode) {
      setErrorMessage("분석할 코드를 먼저 입력해야 한다.");
      setAnalysisResult(null);
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setAnalysisResult(null);
    setCurrentHistoryId(null);
    setProgressLine("");

    const controller = new AbortController();
    abortRef.current = controller;

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
            providerSettings,
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
        setAnalysisResult(saved);
        saveToHistory({
          code: nextCode,
          providerId,
          result: saved,
          title: generateAutoTitle(saved, nextCode),
          createdAt: new Date().toISOString(),
        }).then((savedId) => {
          setCurrentHistoryId(savedId);
          return getAllHistory();
        }).then(setHistoryEntries).catch(() => {});
      }
    } catch (error) {
      // 유저가 멈추기를 누른 경우 — 에러로 띄우지 않고 조용히 종료.
      if (error instanceof DOMException && error.name === "AbortError") {
        setAnalysisResult(null);
      } else {
        setAnalysisResult(null);
        setErrorMessage(formatFetchError(error));
      }
    } finally {
      abortRef.current = null;
      setProgressLine("");
      setIsLoading(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleRestoreHistory(entry: HistoryEntry) {
    setCode(entry.code);
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
    clearHistory().then(() => setHistoryEntries([])).catch(() => {});
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
            providerId={providerId}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onProviderChange={handleProviderChange}
            onAnalyze={handleAnalyze}
            onCancel={handleCancel}
            onSettingsOpen={() => setIsSettingsOpen(true)}
          />
        }
        learningPanel={
        <LearningPanel
          providerId={providerId}
          isLoading={isLoading}
          progressLine={progressLine}
          errorMessage={errorMessage}
          result={analysisResult}
          code={code}
          activeLine={activeLineLink?.line ?? null}
          activeLineSource={activeLineLink?.source}
          onLineFocus={focusLineFromPanel}
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
        />
      }
        editor={
          <CodeInputArea
            code={code}
            isLoading={isLoading}
            languageChoice={languageChoice}
            editorLanguage={editorLanguage}
            onLanguageChoiceChange={setLanguageChoice}
            onCodeChange={handleCodeChange}
            activeLine={activeLineLink?.line ?? null}
            onLineClick={focusLineFromEditor}
          />
        }
      />
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={providerSettings}
        onSave={handleSettingsSave}
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
