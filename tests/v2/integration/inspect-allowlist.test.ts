import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 inspect allowlist", () => {
  it("documents readonly inspect allowlist and outputs", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    expect(spec.cli_contracts.inspect.mode).toBe("readonly");
    expect(spec.cli_contracts.inspect.allowlist).toContain("rg");
    expect(spec.cli_contracts.inspect.outputs).toContain("verified_capability_report");
  });
});
