import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter, join } from "node:path";

import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProvider } from "./types";

const CLAUDE_COMMAND_CANDIDATES = ["claude", "claude.cmd", "claude.exe"] as const;

interface ClaudeAvailabilityResult {
  available: boolean;
  commandPath?: string;
  message: string;
}

export const claudeAgentProvider: AgentProvider = {
  metadata: {
    id: "claude-agent",
    label: "Claude Agent",
    description:
      "Provider scaffold for Claude Agent SDK or Claude Code based analysis in the user's local environment.",
    executionLocation: "local-server",
    dataHandling: "remote-provider",
    capabilities: {
      streaming: false,
      cancellation: false,
      fileSystemAccess: false,
      shellAccess: true,
      requiresApiKey: false,
      requiresLocalProcess: true,
    },
  },
  async analyze(request: AgentAnalyzeRequest): Promise<AgentAnalyzeResponse> {
    const availability = await detectClaudeAvailability();

    if (!availability.available) {
      return {
        providerId: this.metadata.id,
        language: request.detectedLanguage ?? "unknown",
        summary:
          "Claude Agent provider is registered, but a local Claude runtime was not detected in this environment.",
        lineExplanations: [],
        tokens: [],
        concepts: [],
        warnings: [
          {
            code: "PARTIAL_PARSE",
            message: availability.message,
          },
        ],
        createdAt: new Date().toISOString(),
      };
    }

    return {
      providerId: this.metadata.id,
      language: request.detectedLanguage ?? "unknown",
      summary: `Claude runtime detected at ${availability.commandPath}, but the live Claude bridge is not connected yet.`,
      lineExplanations: [],
      tokens: [],
      concepts: [],
      warnings: [
        {
          code: "PARTIAL_PARSE",
          message:
            "Claude runtime is available, but the live Claude Agent SDK or Claude Code bridge is not implemented yet.",
        },
      ],
      createdAt: new Date().toISOString(),
    };
  },
};

async function detectClaudeAvailability(): Promise<ClaudeAvailabilityResult> {
  const explicitCommand = process.env.NUNOPI_CLAUDE_COMMAND?.trim();

  if (explicitCommand) {
    const exists = await isExecutableFile(explicitCommand);

    if (exists) {
      return {
        available: true,
        commandPath: explicitCommand,
        message: `Claude runtime detected at ${explicitCommand}.`,
      };
    }

    return {
      available: false,
      message:
        "NUNOPI_CLAUDE_COMMAND is set, but the target file does not exist or is not executable.",
    };
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    for (const command of CLAUDE_COMMAND_CANDIDATES) {
      const candidatePath = join(entry, command);

      if (await isExecutableFile(candidatePath)) {
        return {
          available: true,
          commandPath: candidatePath,
          message: `Claude runtime detected at ${candidatePath}.`,
        };
      }
    }
  }

  return {
    available: false,
    message:
      "Claude runtime was not found in PATH. Install Claude Code or set NUNOPI_CLAUDE_COMMAND to a valid executable path.",
  };
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}
