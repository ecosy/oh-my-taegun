import { describe, expect, it } from "vitest";
import { evaluateTraceability } from "../../../src/validation/traceability-gate.js";
import { loadV2Documents } from "../helpers/load-v2-doc.js";

describe("v2 docs traceability", () => {
  it("keeps MUST requirements mapped to acceptance, test plan, and task contracts", async () => {
    const documents = await loadV2Documents();
    const result = evaluateTraceability(documents);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
