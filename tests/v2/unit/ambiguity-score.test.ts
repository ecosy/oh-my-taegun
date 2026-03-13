import { describe, expect, it } from "vitest";
import { calculateAmbiguityScore } from "../../../src/v2/metrics.js";

describe("v2 ambiguity score", () => {
  it("fails seed freeze when model policy or required slots are incomplete", () => {
    const scorecard = calculateAmbiguityScore({
      openQuestions: ["Need deployment policy"],
      requiredSlots: {
        goal: true,
        constraints: false,
        successCriteria: true,
      },
      policy: {
        surveyedModels: ["company-low", "company-high"],
        approvedModels: ["company-low", "company-high"],
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
        requiresManualOverrideFor: ["seed_freeze"],
        recordedAt: new Date().toISOString(),
        openQuestions: ["Default execution model must be selected when multiple approved models exist."],
      },
      verifiedCapabilityReport: {
        classification: "supported",
        runtime: "Node.js",
        packageManager: "npm",
        languages: ["TypeScript/JavaScript"],
        verified: {
          buildCommands: ["npm run build"],
          testCommands: [],
          lintCommands: [],
          typecheckCommands: ["npm run check"],
          deploymentTargets: [],
          secretRequirements: [],
          externalWriteSurfaces: [],
        },
        unverified: {
          buildCommands: [],
          testCommands: ["npm run test"],
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

    expect(scorecard.score).toBeGreaterThan(scorecard.threshold);
    expect(scorecard.passed).toBe(false);
    expect(scorecard.openQuestions).toContain("Default execution model must be selected when multiple approved models exist.");
  });
});
