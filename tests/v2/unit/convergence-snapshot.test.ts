import { describe, expect, it } from "vitest";
import { buildConvergenceSnapshot } from "../../../src/v2/ontology.js";

describe("v2 convergence snapshot", () => {
  it("detects missing requirement and policy drift from execution summary", () => {
    const snapshot = buildConvergenceSnapshot({
      designSeed: {
        generatedAt: new Date().toISOString(),
        nodes: [
          { name: "REQ-1", kind: "requirement", refs: [] },
          { name: "REQ-2", kind: "requirement", refs: [] },
          { name: "AC-1", kind: "acceptance", refs: [] },
          { name: "low_capability", kind: "policy", refs: ["company-low"] },
        ],
        designSummary: "fixture",
      },
      completedRequirementIds: ["REQ-1"],
      coveredAcceptanceIds: [],
      executionModelPolicy: {
        surveyedModels: ["company-high"],
        approvedModels: ["company-high"],
        defaultDesignModel: "company-high",
        defaultExecutionModel: "company-high",
        defaultVerifierModel: "company-high",
        allowedReasoningEfforts: ["medium"],
        fallbackChain: { models: [] },
        maxAttemptsByPhase: {},
        workUnitBudgetProfile: "high_capability",
        workUnitBudget: {
          profile: "high_capability",
          maxRequirementIds: 2,
          maxAcceptanceIds: 3,
          maxChangedFiles: 8,
          maxValidationCommands: 3,
          maxAttempts: 3,
          maxOpenQuestionsPerRound: 7,
        },
        requiresManualOverrideFor: [],
        recordedAt: new Date().toISOString(),
        openQuestions: [],
      },
      changedFiles: ["src/extra.ts"],
      blockedReasons: [],
    });

    expect(snapshot.ontologyDriftDetected).toBe(true);
    expect(snapshot.driftCategories).toEqual(
      expect.arrayContaining(["missing_requirement", "missing_acceptance", "policy_shift"]),
    );
    expect(snapshot.replanSuggested).toBe(true);
  });
});
