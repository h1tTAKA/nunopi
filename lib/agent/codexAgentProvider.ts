import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter, join } from "node:path";

import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProvider } from "./types";

const CODEX_COMMAND_CANDIDATES = ["codex", "codex.cmd", "codex.exe"] as const;

interface CodexAvailabilityResult {
  available: boolean;
  commandPath?: string;
  message: string;
}

export const codexAgentProvider: AgentProvider = {
  metadata: {
    id: "codex-agent",
    label: "Codex Agent",
    description:
      "Provider scaffold for OpenAI Codex CLI or app-server based analysis in the user's local environment.",
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
    const availability = await detectCodexAvailability();

    if (!availability.available) {
      return {
        providerId: this.metadata.id,
        language: request.detectedLanguage ?? "unknown",
        summary:
          "Codex Agent provider is registered, but a local Codex runtime was not detected in this environment.",
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
      summary: `Codex runtime detected at ${availability.commandPath}, but the live Codex bridge is not implemented yet.`,
      lineExplanations: [],
      tokens: [],
      concepts: [],
      warnings: [
        {
          code: "PARTIAL_PARSE",
          message:
            "Codex runtime is available, but the live Codex CLI or app-server bridge is not implemented yet.",
        },
      ],
      createdAt: new Date().toISOString(),
    };
  },
};

async function detectCodexAvailability(): Promise<CodexAvailabilityResult> {
  const explicitCommand = process.env.NUNOPI_CODEX_COMMAND?.trim();

  if (explicitCommand) {
    const exists = await isExecutableFile(explicitCommand);

    if (exists) {
      return {
        available: true,
        commandPath: explicitCommand,
        message: `Codex runtime detected at ${explicitCommand}.`,
      };
    }

    return {
      available: false,
      message:
        "NUNOPI_CODEX_COMMAND is set, but the target file does not exist or is not executable.",
    };
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    for (const command of CODEX_COMMAND_CANDIDATES) {
      const candidatePath = join(entry, command);

      if (await isExecutableFile(candidatePath)) {
        return {
          available: true,
          commandPath: candidatePath,
          message: `Codex runtime detected at ${candidatePath}.`,
        };
      }
    }
  }

  return {
    available: false,
    message:
      "Codex runtime was not found in PATH. Install the Codex CLI or set NUNOPI_CODEX_COMMAND to a valid executable path.",
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
