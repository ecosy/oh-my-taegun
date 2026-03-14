import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 doctor preflight", () => {
  it("returns structured preflight checks for the current repository", async () => {
    const repo = await createTempGitRepo();
    const payload = await execV2Cli([
      "doctor",
      "--repo-path",
      repo,
      "--survey-models",
      "company-low",
      "--approved-models",
      "company-low",
    ]);

    expect(payload.preflightChecks.map((check: { code: string }) => check.code)).toEqual(
      expect.arrayContaining([
        "working_tree_clean",
        "default_branch_detected",
        "lockfile_detected",
        "verified_test_commands",
        "workspace_writable",
      ]),
    );
  });
});
