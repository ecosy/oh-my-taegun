import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 resume next actions", () => {
  it("returns the persisted next actions from the run state", async () => {
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

    expect(Array.isArray(resume.nextActions)).toBe(true);
    expect(resume.nextActions.some((action: string) => action.includes("Review the V2 report"))).toBe(true);
  }, 30000);
});
