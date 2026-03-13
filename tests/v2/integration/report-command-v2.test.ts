import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 report command contract", () => {
  it("documents report outputs for ambiguity, convergence, pathology, and model policy", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    expect(spec.cli_contracts.report.outputs).toContain("execution_model_policy");
    expect(spec.cli_contracts.report.outputs).toContain("pathology_signals");
  });
});
