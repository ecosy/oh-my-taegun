import { describe, expect, it } from "vitest";
import { planRequirementSteps } from "../../../src/planning/requirement-step-planner.js";
import { createDocumentSet } from "../../helpers/document-set.js";

describe("v2 policy oversized work units", () => {
  it("marks planning as blocked when a single chunk exceeds the acceptance budget", () => {
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
        ],
      },
      acceptance: {
        acceptance_criteria: [
          {
            id: "AC-001",
            requirement_ids: ["REQ-001"],
            title: "AC1",
            description: "AC1",
            verification: {},
          },
          {
            id: "AC-002",
            requirement_ids: ["REQ-001"],
            title: "AC2",
            description: "AC2",
            verification: {},
          },
          {
            id: "AC-003",
            requirement_ids: ["REQ-001"],
            title: "AC3",
            description: "AC3",
            verification: {},
          },
        ],
      },
      testPlan: {
        test_plan: [
          {
            id: "TP-001",
            acceptance_ids: ["AC-001", "AC-002", "AC-003"],
            category: "unit",
            method: "automated",
            stage: "nightly",
            description: "All",
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
        testCommands: ["npm run test"],
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

    expect(result.workUnits).toHaveLength(0);
    expect(result.blockedReasons).toEqual(["oversized_work_unit:REQ-001"]);
  });
});
