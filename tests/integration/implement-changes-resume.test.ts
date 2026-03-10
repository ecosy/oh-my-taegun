import { describe, expect, it } from "vitest";
import { executeImplementationLoop } from "../../src/orchestrator/loop-controller.js";
import type { WorkUnitExecutor } from "../../src/llm/types.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { createDocumentSet } from "../helpers/document-set.js";

describe("implement-changes resume", () => {
  it("skips already completed requirement steps on resume", async () => {
    const repo = await createTempGitRepo();
    const documents = createDocumentSet();
    let executions = 0;
    const executor: WorkUnitExecutor = {
      async execute() {
        executions += 1;
        return {
          status: "changed",
          summary: "changed",
          changedFiles: ["README.md"],
          suggestedValidationCommands: [],
          unresolvedItems: [],
          evidenceRefs: ["fake-codex"],
          sessionId: "fake-session",
          finalMessagePath: ".omt/llm-results/run-1/wu-002.json",
          jsonEventLogPath: ".omt/llm-events/run-1/wu-002.jsonl",
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
          total_work_units: 2,
          completed_work_units: 1,
          completed_requirement_ids: ["REQ-001"],
          blocked_requirement_ids: [],
        },
      },
      executor,
    });

    expect(executions).toBe(1);
    expect(result.completedRequirementIds).toEqual(expect.arrayContaining(["REQ-001", "REQ-003"]));
  });
});
