import { describe, expect, it } from "vitest";
import { buildExecutionModelPolicy, normalizeModelSurvey } from "../../../src/v2/model-policy.js";
import { loadV2Documents } from "../helpers/load-v2-doc.js";

describe("v2 model survey normalization", () => {
  it("auto-approves a single surveyed model and clamps fallback to approved models", async () => {
    const documents = await loadV2Documents();
    const survey = normalizeModelSurvey({
      surveyModels: "company-low",
      fallbackChain: "company-low,company-high",
    });
    const policy = buildExecutionModelPolicy(documents, survey, {
      executionModel: "company-low",
      fallbackChain: "company-low,company-high",
    });

    expect(survey.approvedModels).toEqual(["company-low"]);
    expect(policy.approvedModels).toEqual(["company-low"]);
    expect(policy.fallbackChain.models).toEqual(["company-low"]);
    expect(policy.openQuestions).toEqual([]);
  });

  it("leaves model selection open when multiple models are approved without defaults", async () => {
    const documents = await loadV2Documents();
    const survey = normalizeModelSurvey({
      surveyModels: "company-low,company-high",
      approvedModels: "company-low,company-high",
    });
    const policy = buildExecutionModelPolicy(documents, survey, {});

    expect(policy.openQuestions).toContain("Default execution model must be selected when multiple approved models exist.");
  });
});
