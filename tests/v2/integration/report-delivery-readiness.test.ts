import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 report delivery readiness", () => {
  it("reports dry-run readiness, blocking checks, and next actions after a successful V2 run", async () => {
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

    expect(report.deliveryStatus.deliveryReadiness).toBe("dry-run-ready");
    expect(Array.isArray(report.deliveryStatus.blockingChecks)).toBe(true);
    expect(report.deliveryStatus.blockingChecks.every((check: { passed: boolean }) => check.passed)).toBe(true);
    expect(report.deliveryStatus.nextActions.some((action: string) => action.includes("Review the V2 report"))).toBe(true);
  }, 30000);
});
