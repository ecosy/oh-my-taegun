import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { writeAnswersFile } from "../helpers/answers-file.js";

describe("v2 prod delivery approval gate", () => {
  it("blocks seed freeze when prod delivery is selected without per-run approval", async () => {
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
        targetStage: "prod",
        realPr: {
          targetBranch: "main",
          featureBranchTemplate: "feature/omt-v2-{run_id}",
          titleTemplate: "OMT V2 {run_id}",
        },
        dev: {
          command: "echo dev",
          validationCommand: "echo dev-ok",
          runnerKind: "shell",
          envRefs: [],
        },
        prod: {
          command: "echo prod",
          validationCommand: "echo prod-ok",
          runnerKind: "shell",
          envRefs: [],
          approvedForThisRun: false,
        },
      },
    });

    const payload = await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--non-interactive",
      "--answers-file",
      answersFile,
    ]);

    expect(payload.status).toBe("blocked");
    expect(payload.blockedReasons.some((reason: { code: string }) => reason.code === "delivery_policy_unconfirmed")).toBe(true);
    await expect(access(`${repo}/.omt/v2/design/seed.json`)).rejects.toThrow();
  });
});
