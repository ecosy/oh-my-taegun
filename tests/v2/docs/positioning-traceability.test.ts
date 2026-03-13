import { describe, expect, it } from "vitest";
import { loadV2Markdown } from "../helpers/load-v2-doc.js";

describe("v2 positioning traceability", () => {
  it("states interview-derived model policy and excludes hardcoded baseline models", async () => {
    const markdown = await loadV2Markdown("docs/v2/positioning.md");
    expect(markdown).toContain("interview-derived");
    expect(markdown).toContain("team runtime");
    expect(markdown).not.toContain("baseline 모델은 `gpt-5.2 Codex`");
  });
});
