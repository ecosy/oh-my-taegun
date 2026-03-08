import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { projectRoot } from "../helpers/project-root.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";

const execFileAsync = promisify(execFile);

describe("local-first e2e", () => {
  it("runs the harness against a local repo and emits structured output", async () => {
    const repo = await createTempGitRepo();
    const result = await execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "run",
      "--project-root",
      projectRoot,
      "--repo-path",
      repo,
    ], { cwd: projectRoot });

    const payload = JSON.parse(result.stdout);
    expect(payload.runId).toMatch(/^\d{14}$/u);
    expect(Array.isArray(payload.blockedReasons)).toBe(true);
  });
});
