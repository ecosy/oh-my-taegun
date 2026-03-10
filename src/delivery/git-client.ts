import { runCommand } from "../shared/command.js";

export async function currentBranch(workspace: string): Promise<string> {
  const result = await runCommand("git", ["-C", workspace, "symbolic-ref", "--short", "HEAD"]);
  return result.stdout || "main";
}

export async function ensureFeatureBranch(workspace: string, branchName: string): Promise<void> {
  try {
    await runCommand("git", ["-C", workspace, "checkout", branchName]);
  } catch {
    await runCommand("git", ["-C", workspace, "checkout", "-b", branchName]);
  }
}

export async function hasWorkingTreeChanges(workspace: string): Promise<boolean> {
  const result = await runCommand("git", ["-C", workspace, "status", "--porcelain"]);
  return result.stdout.length > 0;
}

export async function commitWorkingTree(workspace: string, message: string): Promise<boolean> {
  if (!(await hasWorkingTreeChanges(workspace))) {
    return false;
  }

  await runCommand("git", ["-C", workspace, "add", "-A"]);
  await runCommand("git", ["-C", workspace, "commit", "-m", message]);
  return true;
}

export async function hasOrigin(workspace: string): Promise<boolean> {
  try {
    await runCommand("git", ["-C", workspace, "remote", "get-url", "origin"]);
    return true;
  } catch {
    return false;
  }
}

export async function branchExists(workspace: string, branchName: string, originUrl?: string): Promise<boolean> {
  if (await refExists(workspace, branchName)) {
    return true;
  }
  if (await refExists(workspace, `origin/${branchName}`)) {
    return true;
  }
  try {
    const result = await runCommand(
      "git",
      [...gitNetworkArgs(originUrl), "-C", workspace, "ls-remote", "--heads", "origin", branchName],
    );
    return result.stdout.length > 0;
  } catch {
    return false;
  }
}

export async function branchHasDiffFromBase(
  workspace: string,
  baseBranch: string,
  headBranch: string,
  originUrl?: string,
): Promise<boolean> {
  try {
    const comparableBase = await resolveComparableBase(workspace, baseBranch, originUrl);
    const result = await runCommand("git", ["-C", workspace, "rev-list", "--left-right", "--count", `${comparableBase}...${headBranch}`]);
    const parts = result.stdout.split(/\s+/u);
    const ahead = Number(parts[1] ?? "0");
    return ahead > 0;
  } catch {
    return false;
  }
}

export async function pushBranch(workspace: string, branchName: string, originUrl?: string): Promise<void> {
  await runCommand(
    "git",
    [...gitNetworkArgs(originUrl), "-C", workspace, "push", "-u", "origin", branchName],
  );
}

async function resolveComparableBase(workspace: string, baseBranch: string, originUrl?: string): Promise<string> {
  if (await refExists(workspace, baseBranch)) {
    return baseBranch;
  }

  try {
    await runCommand(
      "git",
      [...gitNetworkArgs(originUrl), "-C", workspace, "fetch", "origin", `${baseBranch}:${baseBranch}`],
    );
    return baseBranch;
  } catch {
    if (await refExists(workspace, `origin/${baseBranch}`)) {
      return `origin/${baseBranch}`;
    }
    return baseBranch;
  }
}

async function refExists(workspace: string, ref: string): Promise<boolean> {
  try {
    await runCommand("git", ["-C", workspace, "rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
}

function gitNetworkArgs(originUrl?: string): string[] {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!originUrl?.includes("github.com") || !token) {
    return [];
  }

  const auth = Buffer.from(`oauth2:${token}`, "utf8").toString("base64");
  return ["-c", `http.https://github.com/.extraheader=AUTHORIZATION: basic ${auth}`];
}
