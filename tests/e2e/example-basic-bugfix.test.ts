import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { createTempProjectDocs } from "../helpers/temp-project.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { projectRoot } from "../helpers/project-root.js";

const execFileAsync = promisify(execFile);

describe("example basic bugfix", () => {
  it("fixes a small broken function and passes validation", async () => {
    const repo = await createTempGitRepo({
      scripts: {
        test: "node test.js",
        build: "node -e \"process.exit(0)\"",
      },
      files: {
        "src/add.js": "export function add(a, b) { return a; }\n",
        "test.js": "import { add } from './src/add.js';\nif (add(1, 2) !== 3) process.exit(1);\n",
      },
    });
    const project = await createTempProjectDocs({
      profileId: "fixture-basic-bugfix",
      requirements: [
        {
          id: "REQ-BASIC-001",
          priority: "MUST",
          title: "Fix add()",
          description: "Correct add(a, b) so it returns the sum of both inputs.",
          source_refs: ["fixture-bugfix"],
        },
      ],
      acceptance: [
        {
          id: "AC-BASIC-001",
          requirement_ids: ["REQ-BASIC-001"],
          title: "add() returns 3 for 1 and 2",
          description: "The small bug is fixed and tests pass.",
          verification: { automated: { commands: ["npm test"] } },
        },
      ],
      testPlan: [
        {
          id: "TP-BASIC-001",
          acceptance_ids: ["AC-BASIC-001"],
          category: "unit",
          method: "automated",
          stage: "nightly",
          description: "Run the add() unit check.",
        },
      ],
    });
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "changed",
      OMT_FAKE_CODEX_TARGET_FILE: "src/add.js",
      OMT_FAKE_CODEX_TARGET_CONTENT: "export function add(a, b) { return a + b; }\n",
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

    const implementation = await readFile(`${repo}/src/add.js`, "utf8");
    expect(implementation).toContain("a + b");

    const validation = JSON.parse(await readFile(`${repo}/.omt/validation/${payload.runId}/wu-001.json`, "utf8"));
    expect(validation.validation.passed).toBe(true);
  }, 15000);
});
