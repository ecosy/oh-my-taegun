import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 run pathology capture", () => {
  it("records retry_without_new_evidence when repeated no-change attempts happen", async () => {
    const repo = await createTempGitRepo({
      scripts: {
        test: "node -e \"process.exit(1)\"",
      },
    });
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
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "no-change",
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
    ]);

    expect(run.status).toBe("blocked");
    expect(report.pathologySignals.some((signal: { type: string; detected: boolean }) => signal.type === "retry_without_new_evidence" && signal.detected)).toBe(true);
  }, 30000);
});
