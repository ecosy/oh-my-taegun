import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 resume command contract", () => {
  it("documents phase-aware resume outputs including model policy", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    expect(spec.cli_contracts.resume.outputs).toContain("phase");
    expect(spec.cli_contracts.resume.outputs).toContain("execution_model_policy");
  });
});
