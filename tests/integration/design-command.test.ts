import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { projectRoot } from "../helpers/project-root.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";

const execFileAsync = promisify(execFile);

describe("design command", () => {
  it("prints repository, capability, and traceability data", async () => {
    const repo = await createTempGitRepo();
    const result = await execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "design",
      "--project-root",
      projectRoot,
      "--repo-path",
      repo,
    ], { cwd: projectRoot });
    const payload = JSON.parse(result.stdout);
    expect(payload.mode).toBe("design");
    expect(payload.repository.localWorkspace).toBe(repo);
    expect(payload.traceability.passed).toBe(true);
  });
});
