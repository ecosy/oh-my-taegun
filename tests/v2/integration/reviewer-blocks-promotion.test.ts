import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { writeAnswersFile } from "../helpers/answers-file.js";

describe("v2 reviewer gate", () => {
  it("blocks promotion before PR delivery when reviewer does not approve", async () => {
    const repo = await createTempGitRepo();
    const answersFile = await writeAnswersFile({
      modelPolicy: {
        surveyModels: "company-low",
        approvedModels: "company-low",
        executionModel: "company-low",
        verifierModel: "company-low",
        designModel: "company-low",
      },
      deliveryPolicy: {
        targetStage: "real-pr",
        realPr: {
          targetBranch: "main",
          featureBranchTemplate: "feature/omt-v2-{run_id}",
          titleTemplate: "OMT V2 {run_id}",
        },
      },
    });
    await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--non-interactive",
      "--answers-file",
      answersFile,
    ]);
    const env = await createFakeCodexEnv({
      OMT_REVIEWER_STATUS: "block",
    });
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
    ], { env });

    expect(run.status).toBe("blocked");
    expect(run.blockedReasons.some((reason: { code: string }) => reason.code === "reviewer_block")).toBe(true);
    expect(report.reviewerDecision.status).toBe("block");
    expect(report.deliveryStatus.deliveryReadiness).toBe("blocked-on-review");
  }, 30000);
});
