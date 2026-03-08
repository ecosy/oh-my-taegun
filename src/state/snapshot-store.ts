import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SnapshotState } from "../shared/types.js";

function snapshotDir(workspace: string, runId: string): string {
  return join(workspace, ".omt", "sessions", runId);
}

function snapshotPath(workspace: string, runId: string, iteration: number): string {
  return join(snapshotDir(workspace, runId), `snapshot-${iteration}.json`);
}

export async function writeSnapshot(workspace: string, snapshot: SnapshotState): Promise<string> {
  const dir = snapshotDir(workspace, snapshot.run_id);
  await mkdir(dir, { recursive: true });
  const path = snapshotPath(workspace, snapshot.run_id, snapshot.iteration);
  await writeFile(path, JSON.stringify(snapshot, null, 2));
  return path;
}

export async function latestSnapshot(workspace: string, runId: string): Promise<SnapshotState | null> {
  const dir = snapshotDir(workspace, runId);
  const entries = await readdir(dir).catch(() => []);
  const latest = entries
    .filter((entry) => entry.startsWith("snapshot-") && entry.endsWith(".json"))
    .sort((a, b) => {
      const left = Number(a.replace(/[^\d]/gu, ""));
      const right = Number(b.replace(/[^\d]/gu, ""));
      return right - left;
    })[0];

  if (!latest) {
    return null;
  }

  const raw = await readFile(join(dir, latest), "utf8");
  return JSON.parse(raw) as SnapshotState;
}
