import { mkdir, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { discoverRun } from "../../../src/watch-v2/discovery.js";

describe("watch discovery", () => {
  it("selects the newest event log when runId is omitted", async () => {
    const repo = await createTempGitRepo();
    const eventsDir = join(repo, ".omt", "v2", "events");
    await mkdir(eventsDir, { recursive: true });
    const older = join(eventsDir, "20260314010101001.jsonl");
    const newer = join(eventsDir, "20260314010101002.jsonl");
    await writeFile(older, "");
    await writeFile(newer, "");
    await utimes(older, new Date("2026-03-14T01:01:01.000Z"), new Date("2026-03-14T01:01:01.000Z"));
    await utimes(newer, new Date("2026-03-14T01:01:02.000Z"), new Date("2026-03-14T01:01:02.000Z"));

    const selection = await discoverRun(repo);

    expect(selection.runId).toBe("20260314010101002");
    expect(selection.eventLogPath).toBe(newer);
    expect(selection.warnings).toEqual([]);
  });

  it("returns a warning when the requested run is missing", async () => {
    const repo = await createTempGitRepo();
    const selection = await discoverRun(repo, "20260314020202002");

    expect(selection.runId).toBe("20260314020202002");
    expect(selection.eventLogPath).toBeNull();
    expect(selection.warnings[0]).toContain("Requested run 20260314020202002 was not found");
  });
});
