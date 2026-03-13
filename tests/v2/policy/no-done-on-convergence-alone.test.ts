import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 policy no done on convergence alone", () => {
  it("blocks verifier completion when validation is missing", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    const blockDecision = (spec.verifier.decisions as Array<Record<string, any>>).find((entry) => entry.id === "verifier_block");
    expect(blockDecision?.when).toContain("validation_missing");
  });
});
