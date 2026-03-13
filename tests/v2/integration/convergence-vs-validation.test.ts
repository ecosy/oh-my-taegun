import { describe, expect, it } from "vitest";
import { buildVerifierDecisions } from "../../../src/v2/verifier.js";

describe("v2 convergence vs validation", () => {
  it("does not treat convergence alone as completion", () => {
    const decisions = buildVerifierDecisions({
      convergenceSnapshot: {
        converged: true,
        ontologyDriftDetected: false,
      },
      featureValidation: {
        passed: false,
        commands: ["npm run test"],
        outputs: [],
        issues: ["Command failed: npm run test"],
      },
      regressionValidation: {
        passed: false,
        commands: ["npm run test"],
        outputs: [],
        issues: ["Command failed: npm run test"],
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

    expect(decisions.some((decision) => decision.id === "verifier_pass")).toBe(false);
    expect(decisions.some((decision) => decision.id === "verifier_block")).toBe(true);
  });
});
