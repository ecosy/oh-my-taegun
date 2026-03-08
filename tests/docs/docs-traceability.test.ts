import { describe, expect, it } from "vitest";
import { loadDocuments } from "../../src/config/load-documents.js";
import { evaluateTraceability } from "../../src/validation/traceability-gate.js";
import { projectRoot } from "../helpers/project-root.js";

describe("docs traceability", () => {
  it("ensures every task in spec.yaml has a task contract", async () => {
    const documents = await loadDocuments(projectRoot);
    const result = evaluateTraceability(documents);
    expect(result.issues.filter((issue) => issue.includes("Task type"))).toEqual([]);
  });
});
