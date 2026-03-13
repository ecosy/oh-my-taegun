import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { createTempProjectDocs } from "../helpers/temp-project.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { projectRoot } from "../helpers/project-root.js";

const execFileAsync = promisify(execFile);

describe("example blocked path", () => {
  it("blocks safely when the implementation attempt edits too broadly", async () => {
    const repo = await createTempGitRepo({
      scripts: {
        test: "node -e \"process.exit(0)\"",
      },
    });
    const project = await createTempProjectDocs({
      profileId: "fixture-blocked-path",
      requirements: [
        {
          id: "REQ-BLOCKED-001",
          priority: "MUST",
          title: "Attempt a small change",
          description: "This requirement should remain tightly scoped to a small edit.",
          source_refs: ["fixture-blocked"],
        },
      ],
      acceptance: [
        {
          id: "AC-BLOCKED-001",
          requirement_ids: ["REQ-BLOCKED-001"],
          title: "Only a narrow change is allowed",
          description: "Broad or unrelated edits should be blocked.",
          verification: { automated: { commands: ["npm test"] } },
        },
      ],
      testPlan: [
        {
          id: "TP-BLOCKED-001",
          acceptance_ids: ["AC-BLOCKED-001"],
          category: "policy",
          method: "automated",
          stage: "nightly",
          description: "Confirm the harness blocks out-of-scope edits.",
        },
      ],
    });
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "out-of-scope",
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
    expect(payload.status).toBe("blocked");
    expect(JSON.stringify(payload.blockedReasons)).toContain("out_of_scope_edit");
    expect(payload.blockedReportPath).toContain(".omt/reports/blocked-");

    const report = await readFile(payload.blockedReportPath, "utf8");
    expect(report).toContain("out_of_scope_edit");
  }, 15000);
});
