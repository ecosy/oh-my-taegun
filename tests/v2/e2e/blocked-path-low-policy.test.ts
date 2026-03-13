import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { loadModelFixture } from "../helpers/model-fixtures.js";

describe("v2 e2e blocked path low policy", () => {
  it("blocks when the executor edits too broadly under the low-capability policy", async () => {
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
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "out-of-scope",
    });
    const run = await execV2Cli([
      "run",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
    ], { env });

    expect(run.status).toBe("blocked");
    expect(run.blockedReasons.some((reason: { code: string }) => reason.code === "out_of_scope_edit")).toBe(true);
  }, 15000);
});
