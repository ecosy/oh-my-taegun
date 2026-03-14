import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { projectRoot } from "../../helpers/project-root.js";

const execFileAsync = promisify(execFile);

describe("v2 interactive design on non-tty", () => {
  it("fails fast when no non-interactive input is provided on a non-tty runner", async () => {
    const repo = await createTempGitRepo();

    await expect(execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
    ], {
      cwd: projectRoot,
    })).rejects.toThrow(/Interactive V2 design requires a TTY/);
  });
});
