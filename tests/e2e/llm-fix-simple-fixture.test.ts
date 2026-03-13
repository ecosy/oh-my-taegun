import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { projectRoot } from "../helpers/project-root.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";

const execFileAsync = promisify(execFile);

describe("llm fix simple fixture", () => {
  it("runs the fake Codex loop and persists LLM artifacts", async () => {
    const repo = await createTempGitRepo();
    const env = await createFakeCodexEnv();
    const result = await execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "run",
      "--project-root",
      projectRoot,
      "--repo-path",
      repo,
    ], { cwd: projectRoot, env });

    const payload = JSON.parse(result.stdout);
    expect(payload.runId).toMatch(/^\d{14}$/u);

    const runState = JSON.parse(await readFile(`${repo}/.omt/state/run.json`, "utf8"));
    expect(runState.implementation.completed_work_units).toBeGreaterThan(0);

    const evidence = await readFile(`${repo}/.omt/evidence.json`, "utf8");
    expect(evidence).toContain("wu-001");
  }, 30000);
});
