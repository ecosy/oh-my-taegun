import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "../../src/shared/command.js";

export async function createTempGitRepoFromTemplate(templateRoot: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "omt-template-repo-"));
  await cp(templateRoot, root, { recursive: true });
  await runCommand("git", ["init", "-b", "main"], root);
  await runCommand("git", ["config", "user.email", "test@example.com"], root);
  await runCommand("git", ["config", "user.name", "Test User"], root);
  await runCommand("git", ["add", "."], root);
  await runCommand("git", ["commit", "-m", "fixture-template"], root);
  return root;
}
