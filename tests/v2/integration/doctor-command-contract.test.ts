import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 doctor command", () => {
  it("emits repository, model survey, credential gaps, and verified capability evidence", async () => {
    const repo = await createTempGitRepo();
    const payload = await execV2Cli([
      "doctor",
      "--repo-path",
      repo,
      "--survey-models",
      "company-low",
      "--approved-models",
      "company-low",
    ]);

    expect(payload.mode).toBe("doctor");
    expect(payload.profileVersion).toBe(2);
    expect(payload.repository.localWorkspace).toBe(repo);
    expect(payload.modelEnvironmentSurvey.surveyedModels).toEqual(["company-low"]);
    expect(payload.verifiedCapabilityReport.verified.testCommands).toContain("npm run test");
    expect(Array.isArray(payload.credentialGaps)).toBe(true);
  });
});
