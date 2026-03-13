import { describe, expect, it } from "vitest";
import { planRequirementSteps } from "../../../src/planning/requirement-step-planner.js";
import { createDocumentSet } from "../../helpers/document-set.js";

describe("v2 planner budget splitting", () => {
  it("respects low-capability limits when planning grouped requirements", () => {
    const documents = createDocumentSet({
      requirements: {
        requirements: [
          {
            id: "REQ-001",
            priority: "MUST",
            title: "One",
            description: "One",
            source_refs: [],
          },
          {
            id: "REQ-002",
            priority: "MUST",
            title: "Two",
            description: "Two",
            source_refs: [],
          },
        ],
      },
      acceptance: {
        acceptance_criteria: [
          {
            id: "AC-001",
            requirement_ids: ["REQ-001", "REQ-002"],
            title: "Shared",
            description: "Shared",
            verification: {},
          },
        ],
      },
      testPlan: {
        test_plan: [
          {
            id: "TP-001",
            acceptance_ids: ["AC-001"],
            category: "unit",
            method: "automated",
            stage: "nightly",
            description: "Shared",
          },
        ],
      },
    });

    const result = planRequirementSteps(documents, {
      runId: "run-1",
      repoRoot: "/tmp/repo",
      capabilities: {
        classification: "supported",
        languages: ["TypeScript/JavaScript"],
        runtime: "Node.js",
        packageManager: "npm",
        buildCommands: ["npm run build"],
        testCommands: ["npm run test", "npm run test:e2e"],
        lintCommands: [],
        typecheckCommands: ["npm run check"],
        deploymentTargets: [],
        secretRequirements: [],
        externalWriteSurfaces: [],
        notes: [],
      },
      budget: {
        profile: "low_capability",
        maxRequirementIds: 1,
        maxAcceptanceIds: 2,
        maxValidationCommands: 2,
        maxAttempts: 3,
        maxChangedFiles: 4,
      },
    });

    expect(result.blockedReasons).toEqual([]);
    expect(result.workUnits).toHaveLength(2);
    expect(result.workUnits.every((unit) => unit.validationCommands.length <= 2)).toBe(true);
  });
});
