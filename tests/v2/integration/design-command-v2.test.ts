import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 design command contract", () => {
  it("documents design outputs including model policy and design package", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    expect(spec.cli_contracts.design.outputs).toContain("execution_model_policy");
    expect(spec.cli_contracts.design.outputs).toContain("design_package");
  });
});
