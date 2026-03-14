import { describe, expect, it } from "vitest";
import { buildConvergenceSnapshot } from "../../../src/v2/ontology.js";
import { buildVerifierDecisions } from "../../../src/v2/verifier.js";

describe("v2 ontology drift replan", () => {
  it("asks for replan when execution summary drifts from the design seed", () => {
    const convergenceSnapshot = buildConvergenceSnapshot({
      designSeed: {
        generatedAt: new Date().toISOString(),
        nodes: [
          { name: "REQ-1", kind: "requirement", refs: [] },
          { name: "AC-1", kind: "acceptance", refs: [] },
          { name: "low_capability", kind: "policy", refs: ["company-low"] },
        ],
        designSummary: "fixture",
      },
      completedRequirementIds: [],
      coveredAcceptanceIds: [],
      executionModelPolicy: {
        surveyedModels: ["company-low"],
        approvedModels: ["company-low"],
        defaultDesignModel: "company-low",
        defaultExecutionModel: "company-low",
        defaultVerifierModel: "company-low",
        allowedReasoningEfforts: ["medium"],
        fallbackChain: { models: [] },
        maxAttemptsByPhase: {},
        workUnitBudgetProfile: "low_capability",
        workUnitBudget: {
          profile: "low_capability",
          maxRequirementIds: 1,
          maxAcceptanceIds: 2,
          maxChangedFiles: 4,
          maxValidationCommands: 2,
          maxAttempts: 3,
          maxOpenQuestionsPerRound: 5,
        },
        requiresManualOverrideFor: [],
        recordedAt: new Date().toISOString(),
        openQuestions: [],
      },
      changedFiles: [],
      blockedReasons: [],
    });
    const decisions = buildVerifierDecisions({
      convergenceSnapshot,
      featureValidation: {
        passed: true,
        commands: ["npm run test"],
        outputs: [],
        issues: [],
      },
      regressionValidation: {
        passed: true,
        commands: ["npm run test"],
        outputs: [],
        issues: [],
      },
      executionModelPolicy: {
        surveyedModels: ["company-low"],
        approvedModels: ["company-low"],
        defaultDesignModel: "company-low",
        defaultExecutionModel: "company-low",
        defaultVerifierModel: "company-low",
        allowedReasoningEfforts: ["medium"],
        fallbackChain: { models: [] },
        maxAttemptsByPhase: {},
        workUnitBudgetProfile: "low_capability",
        workUnitBudget: {
          profile: "low_capability",
          maxRequirementIds: 1,
          maxAcceptanceIds: 2,
          maxChangedFiles: 4,
          maxValidationCommands: 2,
          maxAttempts: 3,
          maxOpenQuestionsPerRound: 5,
        },
        requiresManualOverrideFor: [],
        recordedAt: new Date().toISOString(),
        openQuestions: [],
      },
      verifiedCapabilityReport: {
        classification: "supported",
        runtime: "Node.js",
        packageManager: "npm",
        languages: ["TypeScript/JavaScript"],
        verified: {
          buildCommands: ["npm run build"],
          testCommands: ["npm run test"],
          lintCommands: [],
          typecheckCommands: [],
          deploymentTargets: [],
          secretRequirements: [],
          externalWriteSurfaces: [],
        },
        unverified: {
          buildCommands: [],
          testCommands: [],
          lintCommands: [],
          typecheckCommands: [],
          deploymentTargets: [],
          secretRequirements: [],
          externalWriteSurfaces: [],
        },
        notes: [],
        evidenceRefs: [],
        allowlistUsed: [],
      },
    });

    expect(decisions.some((decision) => decision.id === "verifier_replan")).toBe(true);
    expect(decisions.some((decision) => decision.id === "verifier_pass")).toBe(false);
  });
});
