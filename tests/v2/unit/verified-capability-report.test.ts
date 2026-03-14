import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { inspectCapabilities } from "../../../src/v2/inspect.js";

describe("v2 verified capability report", () => {
  it("separates verified script-backed commands from unverified capability buckets", async () => {
    const repo = await createTempGitRepo({
      scripts: {
        build: "node -e \"process.exit(0)\"",
        lint: "node -e \"process.exit(0)\"",
        "deploy:dev": "node -e \"process.exit(0)\"",
      },
    });
    const report = await inspectCapabilities(repo);

    expect(report.verified.testCommands).toContain("npm run test");
    expect(report.verified.buildCommands).toContain("npm run build");
    expect(report.verified.deploymentTargets).toEqual([]);
    expect(report.unverified.deploymentTargets).toContain("npm run deploy:dev");
    expect(report.unverified.externalWriteSurfaces).toEqual([]);
    expect(report.allowlistUsed).toContain("rg");
  });
});
