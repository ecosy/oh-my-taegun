import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 e2e run low policy smoke", () => {
  it("documents low-policy run smoke coverage", async () => {
    const matrix = await loadV2Yaml<Record<string, any>>("docs/v2/test-matrix.yaml");
    const e2eSuite = (matrix.test_matrix as Array<Record<string, any>>).find((entry) => entry.suite === "e2e-v2");
    expect(e2eSuite?.covers).toContain("run_low_policy_smoke");
  });
});
