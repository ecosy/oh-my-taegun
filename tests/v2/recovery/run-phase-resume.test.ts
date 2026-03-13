import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 run phase resume", () => {
  it("resumes from the latest execution state after a V2 run", async () => {
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
    const resume = await execV2Cli([
      "resume",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--run-id",
      run.runId,
    ]);

    expect(run.profileVersion).toBe(2);
    expect(resume.profileVersion).toBe(2);
    expect(["verify", "deliver"]).toContain(resume.phase);
    expect(resume.executionModelPolicy.defaultExecutionModel).toBe("company-low");
    expect(resume.handoff).toContain("# Handoff");
  }, 30000);
});
