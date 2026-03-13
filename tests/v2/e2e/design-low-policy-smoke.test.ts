import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { loadModelFixture } from "../helpers/model-fixtures.js";

describe("v2 e2e design low policy smoke", () => {
  it("freezes a design package for the low-capability policy fixture", async () => {
    const repo = await createTempGitRepo();
    const fixture = await loadModelFixture("fixture-model-survey-company-low-only");
    const payload = await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--survey-models",
      fixture.surveyModels,
      "--approved-models",
      fixture.approvedModels,
      "--execution-model",
      fixture.executionModel,
      "--verifier-model",
      fixture.verifierModel,
    ]);

    expect(payload.status).toBe("passed");
    expect(payload.executionModelPolicy.workUnitBudgetProfile).toBe("low_capability");
    expect(payload.designPackagePath).toContain(".omt/v2/design/seed.json");
  });
});
