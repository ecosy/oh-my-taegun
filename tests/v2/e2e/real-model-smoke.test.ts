import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

const maybeIt = process.env.OMT_ENABLE_REAL_MODEL_SMOKE === "1" ? it : it.skip;

describe("v2 e2e real model smoke", () => {
  maybeIt("runs a guarded real-model design and dry-run path", async () => {
    const repo = await createTempGitRepo();
    const model = process.env.OMT_REAL_MODEL_NAME ?? process.env.OMT_CODEX_MODEL;

    expect(model).toBeTruthy();

    const design = await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--survey-models",
      model as string,
      "--approved-models",
      model as string,
      "--execution-model",
      model as string,
      "--verifier-model",
      model as string,
    ], { env: process.env });
    const run = await execV2Cli([
      "run",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
    ], { env: process.env });

    expect(design.status).toBe("passed");
    expect(["completed", "blocked"]).toContain(run.status);
  }, 30000);
});
