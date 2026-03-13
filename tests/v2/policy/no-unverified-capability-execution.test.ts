import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runCommand } from "../../../src/shared/command.js";
import { createFakeCodexEnv } from "../../helpers/fake-codex.js";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 policy no unverified capability execution", () => {
  it("blocks execution when required test capability is not verified", async () => {
    const repo = await createTempGitRepo();
    await writeFile(`${repo}/package.json`, JSON.stringify({
      name: "fixture-repo",
      version: "1.0.0",
      scripts: {},
    }, null, 2));
    await runCommand("git", ["add", "package.json"], repo);
    await runCommand("git", ["commit", "-m", "remove test script"], repo);

    const design = await execV2Cli([
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
    expect(design.status).toBe("passed");

    const env = await createFakeCodexEnv();
    const run = await execV2Cli([
      "run",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
    ], { env });

    expect(run.status).toBe("blocked");
    expect(run.blockedReasons.some((reason: { code: string }) => reason.code === "verifier_block")).toBe(true);
  }, 15000);
});
