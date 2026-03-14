import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runCommand } from "../../../src/shared/command.js";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { writeAnswersFile } from "../helpers/answers-file.js";

describe("v2 commit stage", () => {
  it("creates a local commit and stops before remote promotion", async () => {
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
        targetStage: "commit",
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
    const head = await runCommand("git", ["rev-parse", "HEAD"], repo);
    const log = await runCommand("git", ["log", "--pretty=%s", "-1"], repo);
    const runState = JSON.parse(await readFile(`${repo}/.omt/v2/state/run.json`, "utf8"));

    expect(run.status).toBe("completed");
    expect(report.deliveryStatus.completedStages).toContain("commit");
    expect(report.deliveryStatus.completedStages).not.toContain("real-pr");
    expect(report.deliveryStatus.localCommitSha).toBe(head.stdout);
    expect(log.stdout).toContain("chore(omt): v2 run");
    expect(runState.deliveryStatus.currentStage).toBe("commit");
  }, 30000);
});
