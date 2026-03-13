import { describe, expect, it } from "vitest";
import { buildVerifierDecisions } from "../../../src/v2/verifier.js";

describe("v2 verifier decision matrix", () => {
  it("emits pass for converged validated runs and block for missing verified capability", () => {
    const passed = buildVerifierDecisions({
      convergenceSnapshot: {
        converged: true,
        ontologyDriftDetected: false,
      },
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
    const blocked = buildVerifierDecisions({
      convergenceSnapshot: {
        converged: true,
        ontologyDriftDetected: false,
      },
      featureValidation: {
        passed: true,
        commands: [],
        outputs: [],
        issues: [],
      },
      regressionValidation: {
        passed: true,
        commands: [],
        outputs: [],
        issues: [],
      },
      executionModelPolicy: {
        surveyedModels: ["company-low"],
        approvedModels: ["company-low"],
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
        openQuestions: ["No approved models were confirmed."],
      },
      verifiedCapabilityReport: {
        classification: "supported",
        runtime: "Node.js",
        packageManager: "npm",
        languages: ["TypeScript/JavaScript"],
        verified: {
          buildCommands: [],
          testCommands: [],
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

    expect(passed).toEqual([{ id: "verifier_pass", passed: true, reasons: [] }]);
    expect(blocked[0]?.id).toBe("verifier_block");
  });
});
