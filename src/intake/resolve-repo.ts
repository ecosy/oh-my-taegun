import { mkdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { runCommand } from "../shared/command.js";
import { CliError } from "../shared/errors.js";
import type { RepositoryContext, RepositoryInput } from "../shared/types.js";

export async function resolveRepository(input: RepositoryInput): Promise<RepositoryContext> {
  if (!input.gitUrl && !input.repoPath) {
    throw new CliError("Either --git-url or --repo-path is required.");
  }

  if (input.repoPath) {
    const localWorkspace = resolve(input.repoPath);
    await ensureDirectory(localWorkspace);
    const defaultBranch = await detectDefaultBranch(localWorkspace);
    const originUrl = await detectOriginUrl(localWorkspace).catch(() => undefined);
    return {
      canonicalRepoId: basename(localWorkspace),
      localWorkspace,
      defaultBranch,
      originUrl,
    };
  }

  const gitUrl = input.gitUrl!;
  const canonicalRepoId = sanitizeRepoName(gitUrl);
  const localWorkspace = resolve(input.workingRoot, ".omt", "workspaces", canonicalRepoId);
  await mkdir(resolve(localWorkspace, ".."), { recursive: true });

  const exists = await stat(localWorkspace).then(() => true).catch(() => false);
  if (!exists) {
    await runCommand("git", ["clone", gitUrl, localWorkspace], input.workingRoot);
  }

  const defaultBranch = await detectDefaultBranch(localWorkspace);
  return {
    canonicalRepoId,
    localWorkspace,
    defaultBranch,
    originUrl: gitUrl,
  };
}

async function ensureDirectory(path: string): Promise<void> {
  const result = await stat(path).catch(() => null);
  if (!result?.isDirectory()) {
    throw new CliError(`Repository path does not exist or is not a directory: ${path}`);
  }
}

async function detectDefaultBranch(repoPath: string): Promise<string> {
  try {
    const result = await runCommand("git", ["-C", repoPath, "symbolic-ref", "--short", "HEAD"]);
    return result.stdout || "main";
  } catch {
    return "main";
  }
}

async function detectOriginUrl(repoPath: string): Promise<string> {
  const result = await runCommand("git", ["-C", repoPath, "remote", "get-url", "origin"]);
  return result.stdout;
}

function sanitizeRepoName(gitUrl: string): string {
  const repoSegment = gitUrl.split("/").pop() ?? "repo";
  return repoSegment.replace(/\.git$/u, "");
}
