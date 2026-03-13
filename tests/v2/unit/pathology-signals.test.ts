import { describe, expect, it } from "vitest";
import { detectPathologySignals } from "../../../src/v2/pathology.js";

describe("v2 pathology signals", () => {
  it("detects stagnation, oscillation, and repetitive feedback patterns", () => {
    const signals = detectPathologySignals(["a", "b", "a", "b"]);

    expect(signals.find((signal) => signal.type === "oscillation")?.detected).toBe(true);
    expect(signals.find((signal) => signal.type === "repetitive_feedback")?.detected).toBe(true);
    expect(signals.find((signal) => signal.type === "stagnation")?.detected).toBe(false);
  });
});
