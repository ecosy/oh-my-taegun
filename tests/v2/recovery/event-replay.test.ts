import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { appendEvent, readEvents, replayEvents } from "../../../src/v2/event-store.js";

describe("v2 event replay", () => {
  it("reconstructs phase and model policy from the event log", async () => {
    const repo = await createTempGitRepo();
    await appendEvent(repo, "run-1", {
      phase: "design",
      type: "model_policy_confirmed",
      payload: {
        executionModelPolicy: {
          approvedModels: ["company-low"],
        },
      },
    });
    await appendEvent(repo, "run-1", {
      phase: "execute",
      type: "snapshot_written",
      payload: {
        iteration: 11,
      },
    });
    await appendEvent(repo, "run-1", {
      phase: "verify",
      type: "blocked_raised",
      payload: {
        message: "Validation failed.",
      },
    });

    const replay = replayEvents(await readEvents(repo, "run-1"));

    expect(replay.phase).toBe("verify");
    expect(replay.executionModelPolicy?.approvedModels).toEqual(["company-low"]);
    expect(replay.lastSnapshotIteration).toBe(11);
    expect(replay.blockedReasons).toEqual(["Validation failed."]);
  });
});
