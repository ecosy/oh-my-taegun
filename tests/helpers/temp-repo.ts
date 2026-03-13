import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCommand } from "../../src/shared/command.js";

export interface TempGitRepoOptions {
  scripts?: Record<string, string>;
  files?: Record<string, string>;
}

export async function createTempGitRepo(options?: Record<string, string> | TempGitRepoOptions): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "omt-repo-"));
  await runCommand("git", ["init", "-b", "main"], root);
  await runCommand("git", ["config", "user.email", "test@example.com"], root);
  await runCommand("git", ["config", "user.name", "Test User"], root);
  const normalized = normalizeOptions(options);
  const scripts = normalized.scripts ?? {};
  const files = normalized.files ?? {};
  const pkg = {
    name: "fixture-repo",
    version: "1.0.0",
    scripts: {
      test: "node -e \"process.exit(0)\"",
      ...scripts,
    },
  };
  await writeFile(join(root, "package.json"), JSON.stringify(pkg, null, 2));
  await writeFile(join(root, ".env.example"), "DUMMY=1\n");
  await writeFile(join(root, "README.md"), "# fixture\n");
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(root, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
  await runCommand("git", ["add", "."], root);
  await runCommand("git", ["commit", "-m", "fixture"], root);
  return root;
}

function normalizeOptions(options?: Record<string, string> | TempGitRepoOptions): TempGitRepoOptions {
  if (!options) {
    return { scripts: {}, files: {} };
  }

  if (isTempGitRepoOptions(options)) {
    return {
      scripts: options.scripts ?? {},
      files: options.files ?? {},
    };
  }

  return {
    scripts: options,
    files: {},
  };
}

function isTempGitRepoOptions(value: Record<string, string> | TempGitRepoOptions): value is TempGitRepoOptions {
  return "scripts" in value || "files" in value;
}
