import { describe, expect, it } from "vitest";
import { detectCapabilities } from "../../src/intake/detect-capabilities.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";

describe("capability detection", () => {
  it("detects a node repository with test commands", async () => {
    const repo = await createTempGitRepo({
      build: "tsc -p tsconfig.json",
      lint: "eslint .",
      "test:integration": "vitest run",
    });
    const result = await detectCapabilities(repo);
    expect(result.classification).toBe("partial");
    expect(result.runtime).toBe("Node.js");
    expect(result.testCommands).toContain("npm run test");
    expect(result.secretRequirements).toContain(".env.example");
  });
});
