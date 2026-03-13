import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 verifier decision matrix", () => {
  it("defines pass, replan, and block verifier outcomes", async () => {
    const spec = await loadV2Yaml<Record<string, any>>("docs/v2/spec.yaml");
    const decisions = (spec.verifier.decisions as Array<{ id: string }>).map((entry) => entry.id);
    expect(decisions).toContain("verifier_pass");
    expect(decisions).toContain("verifier_replan");
    expect(decisions).toContain("verifier_block");
  });
});
