import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

function handoffDir(workspace: string, runId: string): string {
  return join(workspace, ".omt", "handoffs", runId);
}

function handoffPath(workspace: string, runId: string, iteration: number): string {
  return join(handoffDir(workspace, runId), `handoff-${iteration}.md`);
}

export async function writeHandoff(
  workspace: string,
  runId: string,
  iteration: number,
  content: string,
): Promise<string> {
  const dir = handoffDir(workspace, runId);
  await mkdir(dir, { recursive: true });
  const path = handoffPath(workspace, runId, iteration);
  await writeFile(path, content);
  return path;
}

export async function latestHandoff(workspace: string, runId: string): Promise<string | null> {
  const dir = handoffDir(workspace, runId);
  const entries = await readdir(dir).catch(() => []);
  const latest = entries
    .filter((entry) => entry.startsWith("handoff-") && entry.endsWith(".md"))
    .sort((a, b) => {
      const left = Number(a.replace(/[^\d]/gu, ""));
      const right = Number(b.replace(/[^\d]/gu, ""));
      return right - left;
    })[0];

  if (!latest) {
    return null;
  }

  return readFile(join(dir, latest), "utf8");
}
