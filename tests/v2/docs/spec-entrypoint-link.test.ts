import { describe, expect, it } from "vitest";
import { loadV2Markdown } from "../helpers/load-v2-doc.js";

describe("v2 spec entrypoint links", () => {
  it("points operators to the guide before the narrative spec", async () => {
    const spec = await loadV2Markdown("docs/v2/spec.md");
    const migration = await loadV2Markdown("docs/v2/migration.md");
    expect(spec).toContain("read `docs/v2/operator-guide.md` first");
    expect(migration).toContain("Agent/operator entrypoint is `AGENTS.md` and `docs/v2/operator-guide.md`.");
  });
});
