import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { projectRoot } from "./project-root.js";
import { createTempGitRepoFromTemplate } from "./template-repo.js";

const execFileAsync = promisify(execFile);

export const chatDogfoodRoot = join(projectRoot, "examples", "chat-mini-web");
export const chatDogfoodFixtureRoot = join(chatDogfoodRoot, "fixture-template");
export const chatDogfoodReferenceRoot = join(chatDogfoodRoot, "reference");

export async function createChatDogfoodRepo(): Promise<string> {
  return createTempGitRepoFromTemplate(chatDogfoodFixtureRoot);
}

export async function readChatDogfoodReference(relativePath: string): Promise<string> {
  return readFile(join(chatDogfoodReferenceRoot, relativePath), "utf8");
}

export async function seedChatDogfoodFile(repoRoot: string, relativePath: string): Promise<void> {
  const content = await readChatDogfoodReference(relativePath);
  await writeFile(join(repoRoot, relativePath), content);
  await execFileAsync("git", ["add", relativePath], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", `Seed ${relativePath}`], { cwd: repoRoot });
}
