import { describe, expect, it } from "vitest";
import { buildWorkUnitPrompt } from "../../src/llm/prompt-builder.js";
import { createDocumentSet } from "../helpers/document-set.js";

describe("prompt builder", () => {
  it("includes requirement, acceptance, test-plan, and forbidden actions", () => {
    const documents = createDocumentSet();
    const prompt = buildWorkUnitPrompt(documents, {
      id: "wu-001",
      runId: "run-1",
      iteration: 1,
      requirementIds: ["REQ-001"],
      acceptanceIds: ["AC-001"],
      testPlanIds: ["TP-001"],
      title: "First unit",
      objective: "Implement REQ-001",
      repoRoot: "/tmp/repo",
      validationCommands: ["npm run test"],
      constraints: ["Only modify one file."],
      editMode: "direct-edit",
      executionScope: "code-and-test",
      model: "gpt-5.4",
      maxAttempts: 3,
    }, {
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

    expect(prompt).toContain("REQ-001");
    expect(prompt).toContain("AC-001");
    expect(prompt).toContain("TP-001");
    expect(prompt).toContain("Do not push changes.");
    expect(prompt).toContain("Do not deploy or perform external writes.");
  });
});
