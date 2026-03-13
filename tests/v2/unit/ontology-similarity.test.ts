import { describe, expect, it } from "vitest";
import { calculateOntologySimilarity } from "../../../src/v2/ontology.js";

describe("v2 ontology similarity", () => {
  it("reports high similarity for stable ontology seeds", () => {
    const similarity = calculateOntologySimilarity(
      {
        generatedAt: "2026-03-14T00:00:00.000Z",
        designSummary: "before",
        nodes: [
          { name: "REQ-001", kind: "requirement", refs: [] },
          { name: "AC-001", kind: "acceptance", refs: [] },
        ],
      },
      {
        generatedAt: "2026-03-14T00:10:00.000Z",
        designSummary: "after",
        nodes: [
          { name: "REQ-001", kind: "requirement", refs: [] },
          { name: "AC-001", kind: "acceptance", refs: [] },
          { name: "low_capability", kind: "policy", refs: [] },
        ],
      },
    );

    expect(similarity).toBeCloseTo(0.667, 3);
  });
});
