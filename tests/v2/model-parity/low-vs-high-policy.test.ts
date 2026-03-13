import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 model parity", () => {
  it("defines low vs high policy parity coverage and fixture pairs", async () => {
    const matrix = await loadV2Yaml<Record<string, any>>("docs/v2/test-matrix.yaml");
    const paritySuite = (matrix.test_matrix as Array<Record<string, any>>).find((entry) => entry.suite === "model-parity-v2");
    const fixtureIds = (matrix.fixtures as Array<{ id: string }>).map((entry) => entry.id);
    expect(paritySuite?.covers).toContain("low_vs_high_policy");
    expect(fixtureIds).toContain("fixture-model-survey-company-low-only");
    expect(fixtureIds).toContain("fixture-model-survey-company-low-plus-high");
  });
});
