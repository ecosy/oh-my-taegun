import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildWorkUnitPrompt } from "./prompt-builder.js";
import { parseWorkUnitResultMessage, workUnitResultJsonSchema } from "./result-schema.js";
import type { WorkUnit, WorkUnitContext, WorkUnitExecutor, WorkUnitResult } from "./types.js";
import type { DocumentSet } from "../shared/types.js";

export class CodexCliAdapter implements WorkUnitExecutor {
  constructor(private readonly documents: DocumentSet) {}

  async execute(unit: WorkUnit, context: WorkUnitContext): Promise<WorkUnitResult> {
    const promptPath = artifactPath(unit.repoRoot, "prompts", unit.runId, `${unit.id}.md`);
    const finalMessagePath = artifactPath(unit.repoRoot, "llm-results", unit.runId, `${unit.id}.json`);
    const jsonEventLogPath = artifactPath(unit.repoRoot, "llm-events", unit.runId, `${unit.id}.jsonl`);
    const schemaPath = artifactPath(unit.repoRoot, "llm-results", unit.runId, `${unit.id}.schema.json`);

    await Promise.all([
      mkdir(dirname(promptPath), { recursive: true }),
      mkdir(dirname(finalMessagePath), { recursive: true }),
      mkdir(dirname(jsonEventLogPath), { recursive: true }),
    ]);

    const prompt = buildWorkUnitPrompt(this.documents, unit, context);
    await writeFile(promptPath, prompt);
    await writeFile(schemaPath, JSON.stringify(workUnitResultJsonSchema(), null, 2));

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(resolveCodexExecutable(), buildArgs(unit, finalMessagePath, schemaPath), {
        cwd: unit.repoRoot,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdin.write(prompt);
      child.stdin.end();

      child.stdout.on("data", (chunk) => {
        stdoutLines.push(chunk.toString());
      });
      child.stderr.on("data", (chunk) => {
        stderrLines.push(chunk.toString());
      });
      child.on("error", reject);
      child.on("close", async (code) => {
        await writeFile(jsonEventLogPath, stdoutLines.join(""));
        if (code !== 0) {
          reject(new Error(stderrLines.join("").trim() || `Codex exited with code ${code}.`));
          return;
        }
        resolve();
      });
    });

    const finalMessage = await readFile(finalMessagePath, "utf8");
    const parsed = parseWorkUnitResultMessage(finalMessage, { finalMessagePath, jsonEventLogPath });
    return {
      ...parsed,
      sessionId: extractSessionId(stdoutLines.join("")),
      evidenceRefs: [...parsed.evidenceRefs, promptPath, finalMessagePath, jsonEventLogPath],
    };
  }
}

function resolveCodexExecutable(): string {
  return process.env.OMT_CODEX_EXECUTABLE ?? "codex";
}

function buildArgs(unit: WorkUnit, finalMessagePath: string, schemaPath: string): string[] {
  const model = process.env.OMT_CODEX_MODEL ?? unit.model;
  return [
    "exec",
    "-C",
    unit.repoRoot,
    ...(model === "default" ? [] : ["-m", model]),
    "-s",
    "workspace-write",
    "-c",
    "approval_policy=\"never\"",
    "--json",
    "--output-schema",
    schemaPath,
    "-o",
    finalMessagePath,
  ];
}

function artifactPath(workspace: string, category: string, runId: string, filename: string): string {
  return join(workspace, ".omt", category, runId, filename);
}

function extractSessionId(jsonl: string): string | undefined {
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    try {
      const payload = JSON.parse(line) as Record<string, unknown>;
      const sessionId = findSessionId(payload);
      if (sessionId) {
        return sessionId;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function findSessionId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.session_id === "string") {
    return record.session_id;
  }
  if (record.session && typeof record.session === "object") {
    const nested = record.session as Record<string, unknown>;
    if (typeof nested.id === "string") {
      return nested.id;
    }
  }

  for (const nested of Object.values(record)) {
    const candidate = findSessionId(nested);
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}
