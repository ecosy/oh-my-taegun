import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 design phase resume", () => {
  it("supports resume during design", async () => {
    const schema = await loadV2Yaml<Record<string, any>>("docs/v2/state-schema.yaml");
    expect(schema.resume_phases).toContain("design");
  });
});
