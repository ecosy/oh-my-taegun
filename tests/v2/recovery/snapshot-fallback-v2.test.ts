import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 snapshot fallback", () => {
  it("documents fallback to the latest healthy snapshot", async () => {
    const schema = await loadV2Yaml<Record<string, any>>("docs/v2/state-schema.yaml");
    expect(schema.recovery_rules.latest_snapshot_corrupt).toBe("fallback_to_previous_healthy_snapshot");
  });
});
