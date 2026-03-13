import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { createChatDogfoodRepo, chatDogfoodFixtureRoot, readChatDogfoodReference } from "../helpers/chat-dogfood.js";
import { projectRoot } from "../helpers/project-root.js";

const execFileAsync = promisify(execFile);

describe("chat dogfood repair", () => {
  it("retries and converges on the reference implementation", async () => {
    const repo = await createChatDogfoodRepo();
    const appReference = await readChatDogfoodReference("public/app.js");
    const serverReference = await readChatDogfoodReference("src/server.js");
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "repair-on-second",
      OMT_FAKE_CODEX_WRITES: JSON.stringify([
        { path: "public/app.js", content: appReference },
        { path: "src/server.js", content: serverReference },
      ]),
      OMT_FAKE_CODEX_WRONG_WRITES: JSON.stringify([
        { path: "public/app.js", content: "export function createInitialChatState(){return {messages:[],pending:true,status:'Streaming...',error:''};}\n" },
        { path: "src/server.js", content: "export function createAppServer(){ throw new Error('broken'); }\n" },
      ]),
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

    const validationArtifact = JSON.parse(await readFile(`${repo}/.omt/validation/${payload.runId}/wu-001.json`, "utf8"));
    expect(validationArtifact.attempt).toBe(2);
  }, 40000);
});
