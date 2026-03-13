import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 doctor command contract", () => {
  it("documents doctor outputs for runtime and model survey evidence", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    expect(spec.cli_contracts.doctor.outputs).toContain("model_environment_survey");
    expect(spec.cli_contracts.doctor.outputs).toContain("credential_gaps");
  });
});
