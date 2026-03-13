import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 e2e design low policy smoke", () => {
  it("includes low-capability survey fixtures in the test matrix", async () => {
    const matrix = await loadV2Yaml<Record<string, any>>("docs/v2/test-matrix.yaml");
    const fixtureIds = (matrix.fixtures as Array<{ id: string }>).map((entry) => entry.id);
    expect(fixtureIds).toContain("fixture-model-survey-company-low-only");
  });
});
