import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 ontology similarity", () => {
  it("defines a convergence threshold and normalized similarity weights", async () => {
    const metrics = await loadV2Yaml<Record<string, any>>("docs/v2/metrics.yaml");
    const weights = Object.values(metrics.ontology_similarity.weights) as number[];
    const total = weights.reduce((sum, value) => sum + value, 0);
    expect(metrics.ontology_similarity.threshold).toBe(0.95);
    expect(total).toBeCloseTo(1, 6);
  });
});
