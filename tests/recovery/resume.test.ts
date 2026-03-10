import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { projectRoot } from "../helpers/project-root.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";

const execFileAsync = promisify(execFile);

describe("resume command", () => {
  it("loads the latest snapshot and handoff", async () => {
    const repo = await createTempGitRepo();
    const env = await createFakeCodexEnv();
    const run = await execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "run",
      "--project-root",
      projectRoot,
      "--repo-path",
      repo,
    ], { cwd: projectRoot, env });

    const runPayload = JSON.parse(run.stdout);
    const resume = await execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "resume",
      "--project-root",
      projectRoot,
      "--repo-path",
      repo,
      "--run-id",
      runPayload.runId,
    ], { cwd: projectRoot });

    const resumePayload = JSON.parse(resume.stdout);
    expect(resumePayload.snapshot.run_id).toBe(runPayload.runId);
    expect(resumePayload.handoff).toContain("# Handoff");
  }, 15000);
});
