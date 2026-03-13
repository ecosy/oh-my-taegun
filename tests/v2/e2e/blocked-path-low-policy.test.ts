import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 e2e blocked path low policy", () => {
  it("includes blocked-path low-policy smoke coverage", async () => {
    const matrix = await loadV2Yaml<Record<string, any>>("docs/v2/test-matrix.yaml");
    const e2eSuite = (matrix.test_matrix as Array<Record<string, any>>).find((entry) => entry.suite === "e2e-v2");
    expect(e2eSuite?.covers).toContain("blocked_path_low_policy");
  });
});
