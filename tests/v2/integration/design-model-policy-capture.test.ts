import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 design model policy capture", () => {
  it("captures execution model policy during design and freezes a design package", async () => {
    const repo = await createTempGitRepo();
    const payload = await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--survey-models",
      "company-low",
      "--approved-models",
      "company-low",
      "--execution-model",
      "company-low",
    ]);

    expect(payload.mode).toBe("design");
    expect(payload.profileVersion).toBe(2);
    expect(payload.status).toBe("passed");
    expect(payload.executionModelPolicy.defaultExecutionModel).toBe("company-low");
    expect(payload.executionModelPolicy.approvedModels).toEqual(["company-low"]);
    expect(payload.designPackagePath).toContain(".omt/v2/design/seed.json");
  });
});
