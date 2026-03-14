import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runCommand } from "../../../src/shared/command.js";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 delivery blocking taxonomy", () => {
  it("classifies missing verified tests as blocked-on-capability", async () => {
    const repo = await createTempGitRepo();
    await writeFile(`${repo}/package.json`, JSON.stringify({
      name: "fixture-repo",
      version: "1.0.0",
      scripts: {},
    }, null, 2));
    await runCommand("git", ["add", "package.json"], repo);
    await runCommand("git", ["commit", "-m", "remove test script"], repo);

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

    expect(run.status).toBe("blocked");
    expect(report.deliveryStatus.deliveryReadiness).toBe("blocked-on-capability");
    expect(report.deliveryStatus.blockingChecks.some((check: { code: string; passed: boolean }) => check.code === "verified_tests_available" && !check.passed)).toBe(true);
  }, 30000);
});
