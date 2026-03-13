import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 run phase resume", () => {
  it("supports resume during execution and verify phases", async () => {
    const schema = await loadV2Yaml<Record<string, any>>("docs/v2/state-schema.yaml");
    expect(schema.resume_phases).toContain("execute");
    expect(schema.resume_phases).toContain("verify");
  });
});
