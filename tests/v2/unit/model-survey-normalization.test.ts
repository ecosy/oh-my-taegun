import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 model survey normalization", () => {
  it("defines the core model policy fields captured during design", async () => {
    const contracts = await loadV2Yaml<Record<string, any>>("docs/v2/model-contracts.yaml");
    const required = contracts.execution_model_policy.required_fields as string[];
    expect(required).toContain("surveyed_models");
    expect(required).toContain("approved_models");
    expect(required).toContain("fallback_chain");
  });
});
