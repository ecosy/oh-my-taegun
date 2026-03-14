import { describe, expect, it } from "vitest";
import { loadV2Markdown } from "../helpers/load-v2-doc.js";

describe("readme start here", () => {
  it("surfaces AGENTS.md and the V2 operator guide near the top", async () => {
    const markdown = await loadV2Markdown("README.md");
    const top = markdown.slice(0, 1200);
    expect(top).toContain("## Start Here");
    expect(top).toContain("AGENTS.md");
    expect(top).toContain("docs/v2/operator-guide.md");
    expect(markdown).toContain("## Quick Start (V2)");
  });
});
