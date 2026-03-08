import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { EvidenceEntry } from "../shared/types.js";

function evidencePath(workspace: string): string {
  return join(workspace, ".omt", "evidence.json");
}

export async function appendEvidence(workspace: string, entry: EvidenceEntry): Promise<string> {
  const path = evidencePath(workspace);
  await mkdir(dirname(path), { recursive: true });
  const current = await readEvidence(workspace);
  current.entries.push(entry);
  await writeFile(path, JSON.stringify(current, null, 2));
  return path;
}

export async function readEvidence(workspace: string): Promise<{ entries: EvidenceEntry[] }> {
  const path = evidencePath(workspace);
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as { entries: EvidenceEntry[] };
  } catch {
    return { entries: [] };
  }
}
