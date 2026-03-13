import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 model contracts schema", () => {
  it("defines required survey and execution policy fields", async () => {
    const contracts = await loadV2Yaml<Record<string, any>>("docs/v2/model-contracts.yaml");
    expect(contracts.model_environment_survey.required_fields).toContain("approved_models");
    expect(contracts.execution_model_policy.required_fields).toContain("default_execution_model");
    expect(contracts.execution_model_policy.rules).toContain("no_unapproved_model_in_fallback_chain");
  });
});
