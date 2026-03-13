import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { createChatDogfoodRepo, chatDogfoodFixtureRoot, readChatDogfoodReference, seedChatDogfoodFile } from "../helpers/chat-dogfood.js";
import { projectRoot } from "../helpers/project-root.js";

const execFileAsync = promisify(execFile);

describe("chat dogfood ui stream", () => {
  it("lets OMT fill the missing client stream accumulation logic", async () => {
    const repo = await createChatDogfoodRepo();
    await seedChatDogfoodFile(repo, "src/server.js");
    await expect(execFileAsync("npm", ["test"], { cwd: repo })).rejects.toBeDefined();

    const appReference = await readChatDogfoodReference("public/app.js");
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "changed",
      OMT_FAKE_CODEX_TARGET_FILE: "public/app.js",
      OMT_FAKE_CODEX_TARGET_CONTENT: appReference,
      OMT_CODEX_MODEL: "gpt-5.4",
    });

    const result = await execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "run",
      "--project-root",
      chatDogfoodFixtureRoot,
      "--repo-path",
      repo,
    ], { cwd: projectRoot, env });

    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe("completed");
    const after = await execFileAsync("npm", ["test"], { cwd: repo });
    expect(after.stdout).toContain("pass");
  }, 40000);
});
