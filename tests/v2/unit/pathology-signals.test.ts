import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 pathology signals", () => {
  it("defines stagnation, oscillation, repetitive feedback, and hard cap thresholds", async () => {
    const metrics = await loadV2Yaml<Record<string, any>>("docs/v2/metrics.yaml");
    expect(metrics.pathology.stagnation_window).toBe(3);
    expect(metrics.pathology.oscillation_period).toBe(2);
    expect(metrics.pathology.repetitive_feedback_overlap).toBe(0.7);
    expect(metrics.pathology.hard_cap_generations).toBe(30);
  });
});
