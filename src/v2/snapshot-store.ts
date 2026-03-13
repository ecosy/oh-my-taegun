import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { v2SnapshotDir, v2SnapshotPath } from "./files.js";

export interface V2SnapshotState {
  runId: string;
  iteration: number;
  createdAt: string;
  phase: string;
  changedFiles: string[];
  failingTests: string[];
  nextActions: string[];
  executionModelPolicy?: unknown;
}

export async function writeV2Snapshot(workspace: string, snapshot: V2SnapshotState): Promise<string> {
  const path = v2SnapshotPath(workspace, snapshot.runId, snapshot.iteration);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(snapshot, null, 2));
  return path;
}

export async function latestV2Snapshot(workspace: string, runId: string): Promise<V2SnapshotState | null> {
  const entries = await sortedSnapshots(workspace, runId);
  if (entries.length === 0) {
    return null;
  }

  for (const entry of entries) {
    try {
      return JSON.parse(await readFile(v2SnapshotPath(workspace, runId, entry), "utf8")) as V2SnapshotState;
    } catch {
      continue;
    }
  }

  return null;
}

export async function corruptLatestV2Snapshot(workspace: string, runId: string): Promise<void> {
  const entries = await sortedSnapshots(workspace, runId);
  if (entries.length === 0) {
    return;
  }
  await writeFile(v2SnapshotPath(workspace, runId, entries[0]), "{broken");
}

async function sortedSnapshots(workspace: string, runId: string): Promise<number[]> {
  const dir = v2SnapshotDir(workspace, runId);
  const entries = await readdir(dir).catch(() => []);
  return entries
    .filter((entry) => entry.startsWith("snapshot-") && entry.endsWith(".json"))
    .map((entry) => Number(entry.replace(/[^\d]/gu, "")))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left);
}
