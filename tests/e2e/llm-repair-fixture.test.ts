import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { projectRoot } from "../helpers/project-root.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";

const execFileAsync = promisify(execFile);

describe("llm repair fixture", () => {
  it("retries and repairs failing validation on a later attempt", async () => {
    const repo = await createTempGitRepo({
      test: "node validate.js",
    });
    await writeFile(join(repo, "validate.js"), `
      import { readFileSync } from "node:fs";
      const content = readFileSync(new URL("./README.md", import.meta.url), "utf8");
      if (!content.includes("fixed")) process.exit(1);
    `);

    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "repair-on-second",
      OMT_FAKE_CODEX_TARGET_FILE: "README.md",
      OMT_FAKE_CODEX_TARGET_CONTENT: "# fixed\\n",
      OMT_FAKE_CODEX_WRONG_CONTENT: "# broken\\n",
    });

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
    expect(JSON.stringify(payload.blockedReasons)).toContain("delivery");
  });
});
