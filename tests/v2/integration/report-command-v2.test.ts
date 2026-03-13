import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 report command", () => {
  it("returns model policy, convergence, pathology, and validation summary after a V2 run", async () => {
    const repo = await createTempGitRepo();
    await execV2Cli([
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
    const env = await createFakeCodexEnv();
    const run = await execV2Cli([
      "run",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
    ], { env });
    const report = await execV2Cli([
      "report",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--run-id",
      run.runId,
    ]);

    expect(report.mode).toBe("report");
    expect(report.profileVersion).toBe(2);
    expect(report.executionModelPolicy.defaultExecutionModel).toBe("company-low");
    expect(report.convergenceSnapshot.converged).toBe(true);
    expect(Array.isArray(report.pathologySignals)).toBe(true);
    expect(report.validationSummary.featureValidation.passed).toBe(true);
  }, 30000);
});
