import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 design gate", () => {
  it("defines model policy capture and ambiguity gate acceptance criteria", async () => {
    const acceptance = await loadV2Yaml<Record<string, any>>("docs/v2/acceptance.yaml");
    const titles = (acceptance.acceptance_criteria as Array<{ title: string }>).map((entry) => entry.title);
    expect(titles).toContain("Model policy capture during design");
    expect(titles).toContain("Ambiguity gate");
  });
});
