import { describe, expect, it } from "vitest";
import { loadDocuments } from "../../src/config/load-documents.js";
import { evaluateTraceability } from "../../src/validation/traceability-gate.js";
import { projectRoot } from "../helpers/project-root.js";

describe("traceability gate", () => {
  it("passes for the current document set", async () => {
    const documents = await loadDocuments(projectRoot);
    const result = evaluateTraceability(documents);
    expect(result.passed).toBe(true);
    expect(result.mustRequirementCount).toBeGreaterThan(0);
    expect(result.issues).toEqual([]);
  });
});
