import { describe, expect, it } from "vitest";
import { CodexCliAdapter } from "../../src/llm/codex-cli-adapter.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { createDocumentSet } from "../helpers/document-set.js";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";

describe("codex cli adapter", () => {
  it("writes prompt, captures events, and parses the final message", async () => {
    const repo = await createTempGitRepo();
    const documents = createDocumentSet({
      projectRoot: repo,
      docsRoot: `${repo}/docs`,
    });
    const env = await createFakeCodexEnv();
    const previousPath = process.env.PATH;
    process.env.PATH = env.PATH;

    try {
      const adapter = new CodexCliAdapter(documents);
      const result = await adapter.execute({
        id: "wu-001",
        runId: "run-1",
        iteration: 1,
        requirementIds: ["REQ-001"],
        acceptanceIds: ["AC-001"],
        testPlanIds: ["TP-001"],
        title: "First unit",
        objective: "Implement REQ-001",
        repoRoot: repo,
        validationCommands: ["npm run test"],
        constraints: ["Only change one file."],
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

      expect(result.status).toBe("changed");
      expect(result.sessionId).toMatch(/^fake-session-/u);
      expect(result.evidenceRefs.some((reference) => reference.includes(".omt/prompts/run-1/wu-001.md"))).toBe(true);
    } finally {
      process.env.PATH = previousPath;
    }
  });
});
