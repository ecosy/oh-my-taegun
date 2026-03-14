import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { writeAnswersFile } from "../helpers/answers-file.js";

describe("v2 design answers file", () => {
  it("freezes delivery policy from a non-interactive answers file", async () => {
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
    const seed = JSON.parse(await readFile(`${repo}/.omt/v2/design/seed.json`, "utf8"));

    expect(payload.status).toBe("passed");
    expect(payload.deliveryPolicy.targetStage).toBe("real-pr");
    expect(seed.deliveryPolicy.targetStage).toBe("real-pr");
  });
});
