import { describe, expect, it } from "vitest";
import { planRequirementSteps } from "../../src/planning/requirement-step-planner.js";
import { createDocumentSet } from "../helpers/document-set.js";

describe("requirement-step planner", () => {
  it("selects MUST requirements only by default and orders them deterministically", () => {
    const documents = createDocumentSet();
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
    });

    expect(result.selectedRequirementIds).toEqual(["REQ-001", "REQ-003"]);
    expect(result.workUnits.map((unit) => unit.requirementIds)).toEqual([["REQ-001"], ["REQ-003"]]);
    expect(result.workUnits[0]?.validationCommands).toEqual(["npm run check", "npm run test", "npm run build"]);
  });
});
