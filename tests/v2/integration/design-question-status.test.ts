import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 design question status", () => {
  it("records question slot and status in interview artifacts and ambiguity payload", async () => {
    const repo = await createTempGitRepo();
    const payload = await execV2Cli([
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
    const interviewLines = (await readFile(`${repo}/.omt/v2/design/interview.jsonl`, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(interviewLines.some((record) => record.slot === "model_policy_clarity" && record.status === "assumed")).toBe(true);
    expect(payload.ambiguityScorecard.slotStatus.model_policy_clarity).toBeDefined();
    expect(Array.isArray(payload.ambiguityScorecard.assumptionsUsed)).toBe(true);
  });
});
