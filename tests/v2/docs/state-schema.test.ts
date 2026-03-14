import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 state schema", () => {
  it("uses event log as source of truth and supports phase-aware resume", async () => {
    const schema = await loadV2Yaml<Record<string, any>>("docs/v2/state-schema.yaml");
    expect(schema.state_model.source_of_truth).toBe("event_log");
    expect(schema.state_model.phase_aware_resume).toBe(true);
    expect(schema.paths.event_log).toContain(".omt/v2/events/");
    expect(schema.event_types).toContain("review_completed");
    expect(schema.resume_phases).toContain("review");
  });
});
