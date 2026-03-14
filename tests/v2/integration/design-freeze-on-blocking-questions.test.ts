import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 design freeze on blocking questions", () => {
  it("does not freeze a design package when blocking questions remain unanswered", async () => {
    const repo = await createTempGitRepo();
    const payload = await execV2Cli([
      "design",
      "--profile",
      "docs/v2/spec.yaml",
      "--repo-path",
      repo,
      "--survey-models",
      "company-low,company-high",
      "--approved-models",
      "company-low,company-high",
    ]);

    expect(payload.status).toBe("blocked");
    expect(payload.ambiguityScorecard.blockingQuestions.length).toBeGreaterThan(0);
    await expect(access(`${repo}/.omt/v2/design/seed.json`)).rejects.toThrow();
  });
});
