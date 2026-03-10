import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { executeImplementationLoop } from "../../src/orchestrator/loop-controller.js";
import type { WorkUnitExecutor } from "../../src/llm/types.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { createDocumentSet } from "../helpers/document-set.js";

describe("implement-changes loop", () => {
  it("completes a requirement step when the executor changes code and validation passes", async () => {
    const repo = await createTempGitRepo();
    const documents = createDocumentSet({
      projectRoot: repo,
      docsRoot: join(repo, "docs"),
    });
    const executor: WorkUnitExecutor = {
      async execute(unit) {
        await writeFile(join(repo, "README.md"), "# changed\n");
        return {
          status: "changed",
          summary: "changed",
          changedFiles: ["README.md"],
          suggestedValidationCommands: [],
          unresolvedItems: [],
          evidenceRefs: [".omt/prompts/run-1/wu-001.md"],
          sessionId: "fake-session-1",
          finalMessagePath: ".omt/llm-results/run-1/wu-001.json",
          jsonEventLogPath: ".omt/llm-events/run-1/wu-001.jsonl",
        };
      },
    };

    const result = await executeImplementationLoop({
      documents,
      repository: {
        canonicalRepoId: "fixture",
        localWorkspace: repo,
        defaultBranch: "main",
      },
      runId: "run-1",
      runState: {
        run_id: "run-1",
        profile_id: "test-profile",
        status: "running",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        repository: {
          canonical_repo_id: "fixture",
          local_workspace: repo,
          default_branch: "main",
        },
        current_task: "implement-changes",
        completed_tasks: [],
        blocked_reasons: [],
        delivery: {
          mode: "dry-run",
          status: "pending",
          target_branch: "develop",
          feature_branch: "feature/omt-run-1",
        },
        validation: {
          traceability: true,
          feature_validation: false,
          regression_validation: false,
        },
        implementation: {
          total_work_units: 0,
          completed_work_units: 0,
          completed_requirement_ids: [],
          blocked_requirement_ids: [],
        },
      },
      executor,
    });

    expect(result.status).toBe("passed");
    expect(result.completedRequirementIds).toContain("REQ-001");
    expect(result.sessionIds).toContain("fake-session-1");
  });
});
