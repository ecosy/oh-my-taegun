import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 event replay", () => {
  it("treats event log as source of truth", async () => {
    const schema = await loadV2Yaml<Record<string, any>>("docs/v2/state-schema.yaml");
    expect(schema.state_model.source_of_truth).toBe("event_log");
    expect(schema.event_types).toContain("resume_prepared");
  });
});
