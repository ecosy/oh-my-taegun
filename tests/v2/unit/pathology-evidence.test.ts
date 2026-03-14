import { describe, expect, it } from "vitest";
import { detectPathologySignals } from "../../../src/v2/pathology.js";

describe("v2 pathology evidence", () => {
  it("records no-evidence retry summaries in the pathology evidence payload", () => {
    const signals = detectPathologySignals([
      { summary: "attempt-1:no-change", hasNewEvidence: false },
      { summary: "attempt-1:no-change", hasNewEvidence: false },
      { summary: "attempt-2:changed", hasNewEvidence: true },
    ]);

    expect(signals.find((signal) => signal.type === "retry_without_new_evidence")?.evidence).toEqual(
      expect.arrayContaining(["attempt-1:no-change"]),
    );
  });
});
