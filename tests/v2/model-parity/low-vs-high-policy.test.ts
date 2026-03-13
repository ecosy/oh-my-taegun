import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { loadModelFixture } from "../helpers/model-fixtures.js";

describe("v2 model parity", () => {
  it("keeps outcome-equivalent completion across low and high capability model policies", async () => {
    const lowRepo = await createTempGitRepo();
    const highRepo = await createTempGitRepo();
    const lowFixture = await loadModelFixture("fixture-model-survey-company-low-only");
    const highFixture = await loadModelFixture("fixture-model-survey-company-low-plus-high");
    const env = await createFakeCodexEnv();

    await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      lowRepo,
      "--survey-models",
      lowFixture.surveyModels,
      "--approved-models",
      lowFixture.approvedModels,
      "--execution-model",
      lowFixture.executionModel,
      "--verifier-model",
      lowFixture.verifierModel,
    ]);
    await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      highRepo,
      "--survey-models",
      highFixture.surveyModels,
      "--approved-models",
      highFixture.approvedModels,
      "--execution-model",
      highFixture.executionModel,
      "--verifier-model",
      highFixture.verifierModel,
      "--work-unit-budget-profile",
      highFixture.workUnitBudgetProfile ?? "high_capability",
    ]);

    const lowRun = await execV2Cli([
      "run",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      lowRepo,
    ], { env });
    const highRun = await execV2Cli([
      "run",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      highRepo,
    ], { env });
    const lowReport = await execV2Cli([
      "report",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      lowRepo,
      "--run-id",
      lowRun.runId,
    ]);
    const highReport = await execV2Cli([
      "report",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      highRepo,
      "--run-id",
      highRun.runId,
    ]);
    const lowResume = await execV2Cli([
      "resume",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      lowRepo,
      "--run-id",
      lowRun.runId,
    ]);
    const highResume = await execV2Cli([
      "resume",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      highRepo,
      "--run-id",
      highRun.runId,
    ]);

    expect(lowRun.status).toBe(highRun.status);
    expect(lowReport.validationSummary.featureValidation.passed).toBe(highReport.validationSummary.featureValidation.passed);
    expect(lowReport.validationSummary.regressionValidation.passed).toBe(highReport.validationSummary.regressionValidation.passed);
    expect(lowRun.blockedReasons.map((reason: { code: string }) => reason.code)).toEqual(
      highRun.blockedReasons.map((reason: { code: string }) => reason.code),
    );
    expect(Boolean(lowResume.phase)).toBe(true);
    expect(Boolean(highResume.phase)).toBe(true);
  }, 45000);
});
