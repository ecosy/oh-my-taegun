import { describe, expect, it } from "vitest";
import { loadV2Markdown } from "../helpers/load-v2-doc.js";

describe("v2 real model smoke docs", () => {
  it("documents the guarded real-model smoke path", async () => {
    const guide = await loadV2Markdown("docs/v2/operator-guide.md");
    const readme = await loadV2Markdown("README.md");

    expect(guide).toContain("## Optional Real Model Smoke");
    expect(guide).toContain("OMT_ENABLE_REAL_MODEL_SMOKE=1");
    expect(guide).toContain("npm run test:e2e:v2:real-smoke");
    expect(readme).toContain("Optional Real Model Smoke");
  });
});
