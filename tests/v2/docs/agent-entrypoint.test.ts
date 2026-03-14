import { describe, expect, it } from "vitest";
import { loadV2Markdown } from "../helpers/load-v2-doc.js";

describe("v2 agent entrypoint", () => {
  it("defines AGENTS.md as the first V2 runtime entrypoint", async () => {
    const markdown = await loadV2Markdown("AGENTS.md");
    expect(markdown).toContain("## Start Here");
    expect(markdown).toContain("docs/v2/operator-guide.md");
    expect(markdown).toContain("doctor -> design:v2 -> run:v2 -> report:v2 -> resume:v2");
  });
});
