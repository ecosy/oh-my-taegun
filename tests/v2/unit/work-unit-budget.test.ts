import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 work unit budget", () => {
  it("defines stricter low-capability budgets than high-capability budgets", async () => {
    const contracts = await loadV2Yaml<Record<string, any>>("docs/v2/model-contracts.yaml");
    const low = contracts.budget_profiles.low_capability;
    const high = contracts.budget_profiles.high_capability;
    expect(low.max_requirement_ids).toBeLessThanOrEqual(high.max_requirement_ids);
    expect(low.max_changed_files).toBeLessThan(high.max_changed_files);
  });
});
