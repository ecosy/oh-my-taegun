import { describe, expect, it } from "vitest";
import { planRequirementSteps } from "../../../src/planning/requirement-step-planner.js";
import { createDocumentSet } from "../../helpers/document-set.js";

describe("v2 work unit budget", () => {
  it("splits grouped requirements to fit the selected budget profile", () => {
    const documents = createDocumentSet({
      requirements: {
        requirements: [
          {
            id: "REQ-001",
            priority: "MUST",
            title: "One",
            description: "One",
            source_refs: ["src-1"],
          },
          {
            id: "REQ-002",
            priority: "MUST",
            title: "Two",
            description: "Two",
            source_refs: ["src-2"],
          },
        ],
      },
      acceptance: {
        acceptance_criteria: [
          {
            id: "AC-001",
            requirement_ids: ["REQ-001", "REQ-002"],
            title: "Shared acceptance",
            description: "Shared acceptance",
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
            description: "Shared plan",
          },
        ],
      },
    });
    const capabilities = {
      classification: "supported" as const,
      languages: ["TypeScript/JavaScript"],
      runtime: "Node.js",
      packageManager: "npm",
      buildCommands: ["npm run build"],
      testCommands: ["npm run test"],
      lintCommands: [],
      typecheckCommands: ["npm run check"],
      deploymentTargets: [],
      secretRequirements: [],
      externalWriteSurfaces: [],
      notes: [],
    };

    const low = planRequirementSteps(documents, {
      runId: "run-1",
      repoRoot: "/tmp/repo",
      capabilities,
      budget: {
        profile: "low_capability",
        maxRequirementIds: 1,
        maxAcceptanceIds: 2,
        maxValidationCommands: 2,
        maxAttempts: 3,
        maxChangedFiles: 4,
      },
    });
    const high = planRequirementSteps(documents, {
      runId: "run-1",
      repoRoot: "/tmp/repo",
      capabilities,
      budget: {
        profile: "high_capability",
        maxRequirementIds: 2,
        maxAcceptanceIds: 3,
        maxValidationCommands: 3,
        maxAttempts: 3,
        maxChangedFiles: 8,
      },
    });

    expect(low.workUnits).toHaveLength(2);
    expect(low.workUnits.every((unit) => unit.requirementIds.length === 1)).toBe(true);
    expect(high.workUnits).toHaveLength(1);
    expect(high.workUnits[0]?.requirementIds).toEqual(["REQ-001", "REQ-002"]);
  });
});
