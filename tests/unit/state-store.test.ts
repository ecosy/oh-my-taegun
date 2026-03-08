import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { historicalRunStatePath, readRunState, readRunStateById, writeRunState } from "../../src/state/state-store.js";
import type { RunState } from "../../src/shared/types.js";

describe("state store", () => {
  it("writes and reads run state", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "omt-state-"));
    const state: RunState = {
      run_id: "20260308210000",
      profile_id: "omt-v1-solo-real-pr",
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      repository: {
        canonical_repo_id: "fixture",
        local_workspace: workspace,
        default_branch: "main",
      },
      current_task: "repo-intake",
      completed_tasks: [],
      blocked_reasons: [],
      delivery: {
        mode: "dry-run",
        status: "pending",
        target_branch: "develop",
        feature_branch: "feature/omt-123",
      },
      validation: {
        traceability: true,
        feature_validation: false,
        regression_validation: false,
      },
    };

    await writeRunState(workspace, state);
    const loaded = await readRunState(workspace);
    const historical = await readRunStateById(workspace, state.run_id);
    expect(loaded.run_id).toBe(state.run_id);
    expect(loaded.delivery.feature_branch).toBe("feature/omt-123");
    expect(historical.run_id).toBe(state.run_id);
    expect(historicalRunStatePath(workspace, state.run_id)).toContain(`/runs/${state.run_id}.json`);
  });
});
