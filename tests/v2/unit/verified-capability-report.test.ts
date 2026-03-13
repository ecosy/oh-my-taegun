import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 verified capability report", () => {
  it("requires verified capability classes before execution", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    expect(spec.capability_inspect.verified_required_for_execution).toContain("test_commands");
    expect(spec.capability_inspect.verified_required_for_execution).toContain("deployment_targets");
    expect(spec.capability_inspect.unverified_behavior).toBe("blocked_or_question");
  });
});
