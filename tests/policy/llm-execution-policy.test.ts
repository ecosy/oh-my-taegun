import { describe, expect, it } from "vitest";
import { buildWorkUnitPrompt } from "../../src/llm/prompt-builder.js";
import { createDocumentSet } from "../helpers/document-set.js";

describe("llm execution policy", () => {
  it("always embeds forbidden side effects in the work-unit prompt", () => {
    const documents = createDocumentSet();
    const prompt = buildWorkUnitPrompt(documents, {
      id: "wu-001",
      runId: "run-1",
      iteration: 1,
      requirementIds: ["REQ-001"],
      acceptanceIds: ["AC-001"],
      testPlanIds: ["TP-001"],
      title: "unit",
      objective: "objective",
      repoRoot: "/tmp/repo",
      validationCommands: ["npm run test"],
      constraints: [],
      editMode: "direct-edit",
      executionScope: "code-and-test",
      model: "gpt-5.2-codex-xhigh",
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

    expect(prompt).toContain("Do not push changes.");
    expect(prompt).toContain("Do not create or update PRs.");
    expect(prompt).toContain("Do not add or rotate secrets.");
  });
});
