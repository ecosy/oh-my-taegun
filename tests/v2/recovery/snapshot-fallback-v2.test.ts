import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { corruptLatestV2Snapshot, latestV2Snapshot, writeV2Snapshot } from "../../../src/v2/snapshot-store.js";

describe("v2 snapshot fallback", () => {
  it("falls back to the latest healthy snapshot when the newest one is corrupt", async () => {
    const repo = await createTempGitRepo();
    await writeV2Snapshot(repo, {
      runId: "run-1",
      iteration: 1,
      createdAt: new Date().toISOString(),
      phase: "design",
      changedFiles: [],
      failingTests: [],
      nextActions: ["one"],
    });
    await writeV2Snapshot(repo, {
      runId: "run-1",
      iteration: 2,
      createdAt: new Date().toISOString(),
      phase: "execute",
      changedFiles: ["README.md"],
      failingTests: [],
      nextActions: ["two"],
    });
    await corruptLatestV2Snapshot(repo, "run-1");

    const snapshot = await latestV2Snapshot(repo, "run-1");

    expect(snapshot?.iteration).toBe(1);
    expect(snapshot?.phase).toBe("design");
  });
});
