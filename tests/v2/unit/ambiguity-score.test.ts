import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 ambiguity score", () => {
  it("defines an ambiguity threshold and normalized weights", async () => {
    const metrics = await loadV2Yaml<Record<string, any>>("docs/v2/metrics.yaml");
    const weights = Object.values(metrics.ambiguity.weights) as number[];
    const total = weights.reduce((sum, value) => sum + value, 0);
    expect(metrics.ambiguity.threshold).toBe(0.2);
    expect(total).toBeCloseTo(1, 6);
  });
});
