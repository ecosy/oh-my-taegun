import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { createTempProjectDocs } from "../helpers/temp-project.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { projectRoot } from "../helpers/project-root.js";

const execFileAsync = promisify(execFile);

describe("example baseline noop", () => {
  it("completes a no-op requirement without changing code", async () => {
    const repo = await createTempGitRepo({
      scripts: {
        test: "node test.js",
        build: "node -e \"process.exit(0)\"",
      },
      files: {
        "src/add.js": "export function add(a, b) { return a + b; }\n",
        "test.js": "import { add } from './src/add.js';\nif (add(1, 2) !== 3) process.exit(1);\n",
      },
    });
    const project = await createTempProjectDocs({
      profileId: "fixture-baseline-noop",
      requirements: [
        {
          id: "REQ-NOOP-001",
          priority: "MUST",
          title: "Preserve the passing implementation",
          description: "If the repository already satisfies the requirement, make no code changes.",
          source_refs: ["fixture-baseline"],
        },
      ],
      acceptance: [
        {
          id: "AC-NOOP-001",
          requirement_ids: ["REQ-NOOP-001"],
          title: "Validation passes without edits",
          description: "Tests and build pass on the current implementation.",
          verification: { automated: { commands: ["npm test", "npm run build"] } },
        },
      ],
      testPlan: [
        {
          id: "TP-NOOP-001",
          acceptance_ids: ["AC-NOOP-001"],
          category: "regression",
          method: "automated",
          stage: "nightly",
          description: "Run test and build to confirm the implementation is already valid.",
        },
      ],
    });
    const before = await readFile(`${repo}/src/add.js`, "utf8");
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "no-change",
      OMT_CODEX_MODEL: "gpt-5.4",
    });

    const result = await execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "run",
      "--project-root",
      project,
      "--repo-path",
      repo,
    ], { cwd: projectRoot, env });

    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe("completed");

    const after = await readFile(`${repo}/src/add.js`, "utf8");
    expect(after).toBe(before);

    const runState = JSON.parse(await readFile(`${repo}/.omt/state/run.json`, "utf8"));
    expect(runState.implementation.completed_work_units).toBe(1);
  }, 15000);
});
