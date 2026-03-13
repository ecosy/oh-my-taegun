import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 design command", () => {
  it("writes design artifacts under .omt/v2/design", async () => {
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

    const survey = JSON.parse(await readFile(`${repo}/.omt/v2/design/model-survey.json`, "utf8"));
    const ontology = JSON.parse(await readFile(`${repo}/.omt/v2/design/ontology.json`, "utf8"));
    const seed = JSON.parse(await readFile(`${repo}/.omt/v2/design/seed.json`, "utf8"));
    const interview = await readFile(`${repo}/.omt/v2/design/interview.jsonl`, "utf8");

    expect(payload.status).toBe("passed");
    expect(survey.approvedModels).toEqual(["company-low"]);
    expect(ontology.nodes.length).toBeGreaterThan(0);
    expect(seed.executionModelPolicy.defaultExecutionModel).toBe("company-low");
    expect(interview).toContain("model-default-execution");
  });
});
