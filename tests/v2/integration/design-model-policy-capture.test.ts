import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 design model policy capture", () => {
  it("captures model policy during design phases", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    expect(spec.cli_contracts.design.phases).toEqual(["doctor", "model_survey", "interview", "ontology", "seed", "freeze"]);
    expect(spec.cli_contracts.design.outputs).toContain("execution_model_policy");
  });
});
