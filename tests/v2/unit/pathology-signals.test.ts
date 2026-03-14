import { describe, expect, it } from "vitest";
import { detectPathologySignals } from "../../../src/v2/pathology.js";

describe("v2 pathology signals", () => {
  it("detects stagnation, oscillation, and repetitive feedback patterns", () => {
    const signals = detectPathologySignals(["a", "b", "a", "b"]);

    expect(signals.find((signal) => signal.type === "oscillation")?.detected).toBe(true);
    expect(signals.find((signal) => signal.type === "repetitive_feedback")?.detected).toBe(true);
    expect(signals.find((signal) => signal.type === "stagnation")?.detected).toBe(false);
  });

  it("detects retry without new evidence when the same summary repeats with no new files", () => {
    const signals = detectPathologySignals([
      { summary: "mode=no-change; prompt_length=10", hasNewEvidence: false },
      { summary: "mode=no-change; prompt_length=10", hasNewEvidence: false },
    ]);

    expect(signals.find((signal) => signal.type === "retry_without_new_evidence")?.detected).toBe(true);
  });
});
