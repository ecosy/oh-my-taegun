import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { execV2Cli } from "../helpers/exec-v2-cli.js";

describe("v2 inspect evidence refs", () => {
  it("includes repository-structure evidence beyond package.json", async () => {
    const repo = await createTempGitRepo({
      files: {
        "package-lock.json": "{\n  \"name\": \"fixture-repo\"\n}\n",
        ".github/workflows/ci.yml": "name: ci\n",
        "tsconfig.json": "{\n  \"compilerOptions\": {}\n}\n",
      },
    });
    const payload = await execV2Cli([
      "inspect",
      "--repo-path",
      repo,
    ]);

    expect(payload.evidenceRefs).toEqual(
      expect.arrayContaining([
        "package.json",
        "package-lock.json",
        ".github/workflows",
        ".env.example",
        "tsconfig.json",
      ]),
    );
  });
});
