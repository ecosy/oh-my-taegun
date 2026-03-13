import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 convergence vs validation", () => {
  it("separates design convergence from implementation validation", async () => {
    const acceptance = await loadV2Yaml<Record<string, any>>("docs/v2/acceptance.yaml");
    const criterion = (acceptance.acceptance_criteria as Array<Record<string, any>>).find((entry) => entry.id === "V2-AC-004");
    expect(criterion?.title).toBe("Convergence and validation separation");
  });
});
