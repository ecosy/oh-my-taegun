import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { projectRoot } from "../helpers/project-root.js";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";

const execFileAsync = promisify(execFile);

describe("run command", () => {
  it("creates blocked-safe runtime artifacts when delivery cannot proceed", async () => {
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
    expect(payload.mode).toBe("run");
    expect(payload.status).toBe("blocked");
    expect(payload.blockedReportPath).toContain(".omt/reports/blocked-");

    const report = await readFile(payload.blockedReportPath, "utf8");
    expect(report).toContain("# Blocked Report");
    expect(report).toContain("credential_or_policy_gap");

    const runStateRaw = await readFile(`${repo}/.omt/state/run.json`, "utf8");
    const runState = JSON.parse(runStateRaw);
    expect(runState.completed_tasks).toContain("run-validation");
    expect(runState.implementation.completed_work_units).toBeGreaterThan(0);
  }, 30000);
});
