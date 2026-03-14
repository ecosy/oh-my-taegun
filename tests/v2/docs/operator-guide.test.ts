import { describe, expect, it } from "vitest";
import { loadV2Markdown } from "../helpers/load-v2-doc.js";

describe("v2 operator guide", () => {
  it("contains the required operational sections", async () => {
    const markdown = await loadV2Markdown("docs/v2/operator-guide.md");
    expect(markdown).toContain("## Golden Path");
    expect(markdown).toContain("## What Exists Today");
    expect(markdown).toContain("## What Does Not Exist Yet");
    expect(markdown).toContain("## How To Read Outputs");
    expect(markdown).toContain("## Acceptance Checklist");
    expect(markdown).toContain("npm run design:v2");
    expect(markdown).not.toContain("아래 5줄이 가장 단순한 V2 실사용 경로다.");
  });
});
