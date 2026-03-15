import { describe, expect, it } from "vitest";
import { loadV2Markdown } from "../helpers/load-v2-doc.js";

describe("v2 day-1 runbook", () => {
  it("documents the company first-day path with skill and CLI fallback", async () => {
    const markdown = await loadV2Markdown("docs/v2/day-1-runbook.md");
    expect(markdown).toContain("## 내일의 목표");
    expect(markdown).toContain("## 오늘 밤 준비할 것");
    expect(markdown).toContain("## 내일 아침 설치 절차");
    expect(markdown).toContain("./scripts/install-codex-skill.sh omt");
    expect(markdown).toContain("target stage는 dry-run");
    expect(markdown).toContain("target stage는 commit");
    expect(markdown).toContain("## raw CLI fallback");
    expect(markdown).toContain("npm run design:v2");
    expect(markdown).toContain("npm run run:v2");
    expect(markdown).toContain("npm run report:v2");
    expect(markdown).toContain("npm run resume:v2");
    expect(markdown).toContain("## 첫날 성공 기준");
  });
});
