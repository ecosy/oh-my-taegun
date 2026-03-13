import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";
import { loadModelFixture } from "../helpers/model-fixtures.js";

describe("v2 e2e repair path low policy", () => {
  it("retries and converges when the first fake Codex attempt fails validation", async () => {
    const repo = await createTempGitRepo({
      scripts: {
        test: "node -e \"const fs=require('node:fs');process.exit(fs.readFileSync('status.txt','utf8').trim()==='ok'?0:1)\"",
      },
      files: {
        "status.txt": "pending\n",
      },
    });
    const fixture = await loadModelFixture("fixture-model-survey-company-low-only");
    await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--survey-models",
      fixture.surveyModels,
      "--approved-models",
      fixture.approvedModels,
      "--execution-model",
      fixture.executionModel,
      "--verifier-model",
      fixture.verifierModel,
    ]);
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "repair-on-second",
      OMT_FAKE_CODEX_TARGET_FILE: "status.txt",
      OMT_FAKE_CODEX_TARGET_CONTENT: "ok\n",
      OMT_FAKE_CODEX_WRONG_CONTENT: "bad\n",
    });
    const run = await execV2Cli([
      "run",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
    ], { env });

    expect(run.status).toBe("completed");
    expect(run.verifierDecisions.some((decision: { id: string; passed: boolean }) => decision.id === "verifier_pass" && decision.passed)).toBe(true);
  }, 30000);
});
