import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { createChatDogfoodRepo, chatDogfoodFixtureRoot, readChatDogfoodReference, seedChatDogfoodFile } from "../helpers/chat-dogfood.js";
import { projectRoot } from "../helpers/project-root.js";

const execFileAsync = promisify(execFile);

describe("chat dogfood server relay", () => {
  it("lets OMT repair the missing downstream done/token mapping", async () => {
    const repo = await createChatDogfoodRepo();
    await seedChatDogfoodFile(repo, "public/app.js");
    await expect(execFileAsync("npm", ["test"], { cwd: repo })).rejects.toBeDefined();

    const serverReference = await readChatDogfoodReference("src/server.js");
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "changed",
      OMT_FAKE_CODEX_TARGET_FILE: "src/server.js",
      OMT_FAKE_CODEX_TARGET_CONTENT: serverReference,
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
