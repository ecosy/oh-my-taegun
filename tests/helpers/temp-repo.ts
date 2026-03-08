import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "../../src/shared/command.js";

export async function createTempGitRepo(packageScripts?: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "omt-repo-"));
  await runCommand("git", ["init", "-b", "main"], root);
  await runCommand("git", ["config", "user.email", "test@example.com"], root);
  await runCommand("git", ["config", "user.name", "Test User"], root);
  const pkg = {
    name: "fixture-repo",
    version: "1.0.0",
    scripts: {
      test: "node -e \"process.exit(0)\"",
      ...packageScripts,
    },
  };
  await writeFile(join(root, "package.json"), JSON.stringify(pkg, null, 2));
  await writeFile(join(root, ".env.example"), "DUMMY=1\n");
  await writeFile(join(root, "README.md"), "# fixture\n");
  await runCommand("git", ["add", "."], root);
  await runCommand("git", ["commit", "-m", "fixture"], root);
  return root;
}
