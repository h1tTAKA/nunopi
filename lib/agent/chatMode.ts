// 학습 챗 — 사용자가 보고 있는 코드에 대해 자유롭게 질문하면 튜터가 한국어로 답한다.
// 응답은 JSON이 아니라 자유 텍스트라, 답을 그대로 summary에 담아 반환한다.
import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProviderKind } from "./types";
import type { TranslateWarning } from "@/lib/translator/types";

const LANG_NAME: Record<AgentAnalyzeRequest["locale"], string> = {
  ko: "Korean",
  ja: "Japanese",
  en: "English",
};

// claude --system-prompt 등에 쓰는 튜터 시스템 프롬프트(프로즈, JSON 아님).
// 답변 언어는 사용자가 설정한 locale을 따른다(ko/ja/en).
export function chatSystemPrompt(locale: AgentAnalyzeRequest["locale"]): string {
  const name = LANG_NAME[locale] ?? "Korean";
  return `You are Nunopi, a friendly coding tutor for a beginner. Answer clearly and concisely in ${name} (plain text / light markdown). Do not output JSON.`;
}

// 코드 + 대화 내역으로 챗 프롬프트를 만든다(마지막이 사용자 질문).
// codex처럼 system prompt를 못 받는 provider도 있어, 언어 지시를 본문에 반드시 포함한다.
export function buildChatPrompt(request: AgentAnalyzeRequest): string {
  const name = LANG_NAME[request.locale] ?? "Korean";
  const messages = request.messages ?? [];
  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Tutor"}: ${m.content}`)
    .join("\n");
  return [
    chatSystemPrompt(request.locale),
    "",
    "Code the user is learning:",
    "```",
    request.code,
    "```",
    "",
    "Conversation:",
    transcript,
    "",
    `Answer the user's last question about the code above in ${name}. Be friendly and to the point.`,
    "",
    "If IT terms came up that the user seemed unfamiliar with, or the user asked to save a term as a card,",
    "append AFTER your answer a fenced block EXACTLY like this (output it raw, do not describe it):",
    "```nunopi-cards",
    `[{"term":"<term>","definition":"<one-line beginner definition in ${name}>","kind":"token|concept|term"}]`,
    "```",
    "Block rules: only terms actually discussed in THIS conversation; at most 3; definitions grounded in what you just explained;",
    "kind = token(a code token) | concept(a programming concept) | term(a general IT term). If there is no such term, omit the block entirely.",
    "Tutor:",
  ].join("\n");
}

// 자유 텍스트 답을 summary에 담은 응답으로 정규화.
export function normalizeChatOutput(
  rawText: string,
  providerId: AgentProviderKind,
): AgentAnalyzeResponse {
  const answer = rawText.trim();
  return chatModeResponse(providerId, answer || "(빈 응답)", []);
}

// 챗 응답 래퍼(성공 답 또는 실패/안내 메시지).
export function chatModeResponse(
  providerId: AgentProviderKind,
  summary: string,
  warnings: TranslateWarning[],
): AgentAnalyzeResponse {
  return {
    providerId,
    mode: "chat",
    language: "text",
    summary,
    lineExplanations: [],
    tokens: [],
    concepts: [],
    warnings,
    createdAt: new Date().toISOString(),
  };
}
