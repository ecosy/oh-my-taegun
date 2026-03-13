import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 inspect allowlist", () => {
  it("returns readonly allowlist-backed capability evidence", async () => {
    const repo = await createTempGitRepo();
    const payload = await execV2Cli([
      "inspect",
      "--repo-path",
      repo,
    ]);

    expect(payload.mode).toBe("inspect");
    expect(payload.profileVersion).toBe(2);
    expect(payload.verifiedCapabilityReport.allowlistUsed).toEqual(
      expect.arrayContaining(["rg", "grep", "ls", "find", "cat", "pwd"]),
    );
    expect(payload.evidenceRefs).toContain("package.json");
  });
});
