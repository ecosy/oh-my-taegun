import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 inspect verification reasons", () => {
  it("explains why capabilities are verified or unverified", async () => {
    const repo = await createTempGitRepo();
    const payload = await execV2Cli([
      "inspect",
      "--repo-path",
      repo,
    ]);

    expect(Array.isArray(payload.verifiedCapabilityReport.verified.reasons)).toBe(true);
    expect(Array.isArray(payload.verifiedCapabilityReport.unverified.reasons)).toBe(true);
    expect(payload.verifiedCapabilityReport.verified.reasons[0]).toContain("package.json");
    expect(payload.verifiedCapabilityReport.unverified.reasons[0].length).toBeGreaterThan(0);
  });
});
