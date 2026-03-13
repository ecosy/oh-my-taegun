import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { projectRoot } from "../helpers/project-root.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";

const execFileAsync = promisify(execFile);

describe("run command validation failures", () => {
  it("blocks when detected test commands fail", async () => {
    const repo = await createTempGitRepo({
      test: "node -e \"process.exit(1)\"",
    });
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
    expect(payload.status).toBe("blocked");
    expect(payload.blockedReasons.some((reason: { code: string }) => reason.code === "feature_validation_failed")).toBe(true);
  }, 15000);
});
