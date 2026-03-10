import type { WorkUnitResult } from "./types.js";

interface ParsedResultPayload {
  status?: unknown;
  summary?: unknown;
  changed_files?: unknown;
  suggested_validation_commands?: unknown;
  unresolved_items?: unknown;
  evidence_refs?: unknown;
}

export function workUnitResultJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "status",
      "summary",
      "changed_files",
      "suggested_validation_commands",
      "unresolved_items",
      "evidence_refs",
    ],
    properties: {
      status: {
        type: "string",
        enum: ["changed", "no_change", "blocked", "failed"],
      },
      summary: { type: "string" },
      changed_files: {
        type: "array",
        items: { type: "string" },
      },
      suggested_validation_commands: {
        type: "array",
        items: { type: "string" },
      },
      unresolved_items: {
        type: "array",
        items: { type: "string" },
      },
      evidence_refs: {
        type: "array",
        items: { type: "string" },
      },
    },
  };
}

export function parseWorkUnitResultMessage(
  rawMessage: string,
  paths: { finalMessagePath: string; jsonEventLogPath: string },
): WorkUnitResult {
  const payload = normalizePayload(JSON.parse(extractJsonObject(rawMessage)) as ParsedResultPayload);
  return {
    status: payload.status,
    summary: payload.summary,
    changedFiles: payload.changedFiles,
    suggestedValidationCommands: payload.suggestedValidationCommands,
    unresolvedItems: payload.unresolvedItems,
    evidenceRefs: payload.evidenceRefs,
    finalMessagePath: paths.finalMessagePath,
    jsonEventLogPath: paths.jsonEventLogPath,
  };
}

function extractJsonObject(rawMessage: string): string {
  const trimmed = rawMessage.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/u);
  if (fencedMatch?.[1]) {
    const candidate = fencedMatch[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) {
      return candidate;
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Missing JSON object in Codex final message.");
  }

  return trimmed.slice(start, end + 1);
}

function normalizePayload(payload: ParsedResultPayload): {
  status: WorkUnitResult["status"];
  summary: string;
  changedFiles: string[];
  suggestedValidationCommands: string[];
  unresolvedItems: string[];
  evidenceRefs: string[];
} {
  const status = payload.status;
  if (status !== "changed" && status !== "no_change" && status !== "blocked" && status !== "failed") {
    throw new Error("Invalid Codex work unit status.");
  }

  if (typeof payload.summary !== "string") {
    throw new Error("Codex work unit summary must be a string.");
  }

  return {
    status,
    summary: payload.summary,
    changedFiles: normalizeStringArray(payload.changed_files, "changed_files"),
    suggestedValidationCommands: normalizeStringArray(
      payload.suggested_validation_commands,
      "suggested_validation_commands",
    ),
    unresolvedItems: normalizeStringArray(payload.unresolved_items, "unresolved_items"),
    evidenceRefs: normalizeStringArray(payload.evidence_refs, "evidence_refs"),
  };
}

function normalizeStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Codex work unit field '${field}' must be a string array.`);
  }
  return value;
}
