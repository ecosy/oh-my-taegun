import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { loadModelFixture } from "../helpers/model-fixtures.js";

describe("v2 e2e run low policy smoke", () => {
  it("completes a V2 dry-run using the low-capability policy fixture", async () => {
    const repo = await createTempGitRepo();
    const fixture = await loadModelFixture("fixture-model-survey-company-low-only");
    await execV2Cli([
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
    const env = await createFakeCodexEnv();
    const run = await execV2Cli([
      "run",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
    ], { env });

    expect(run.status).toBe("completed");
    expect(run.phase).toBe("deliver");
  }, 30000);
});
