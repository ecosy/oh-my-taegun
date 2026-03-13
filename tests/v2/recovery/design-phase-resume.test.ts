import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { appendEvent } from "../../../src/v2/event-store.js";
import { writeV2Snapshot } from "../../../src/v2/snapshot-store.js";
import { prepareV2Resume, writeV2Handoff } from "../../../src/v2/recovery.js";

describe("v2 design phase resume", () => {
  it("restores design-phase state from event log and snapshot", async () => {
    const repo = await createTempGitRepo();
    await appendEvent(repo, "design-run", {
      phase: "design",
      type: "model_policy_confirmed",
      payload: {
        executionModelPolicy: {
          approvedModels: ["company-low"],
        },
      },
    });
    await writeV2Snapshot(repo, {
      runId: "design-run",
      iteration: 1,
      createdAt: new Date().toISOString(),
      phase: "design",
      changedFiles: [],
      failingTests: [],
      nextActions: ["Finish design freeze."],
    });
    await writeV2Handoff(repo, "design-run", "# Handoff\n\n- phase: design\n");

    const resume = await prepareV2Resume(repo, "design-run");

    expect(resume.phase).toBe("design");
    expect(resume.snapshot?.phase).toBe("design");
    expect(resume.handoff).toContain("phase: design");
  });
});
