import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { v2RunStateByIdPath, v2RunStatePath } from "./files.js";
import type { V2RunState } from "./types.js";

export async function writeV2RunState(workspace: string, state: V2RunState): Promise<string> {
  const currentPath = v2RunStatePath(workspace);
  const historicalPath = v2RunStateByIdPath(workspace, state.runId);
  await mkdir(dirname(currentPath), { recursive: true });
  await mkdir(dirname(historicalPath), { recursive: true });
  const payload = JSON.stringify(state, null, 2);
  await writeFile(currentPath, payload);
  await writeFile(historicalPath, payload);
  return currentPath;
}

export async function readV2RunState(workspace: string): Promise<V2RunState> {
  return JSON.parse(await readFile(v2RunStatePath(workspace), "utf8")) as V2RunState;
}

export async function readV2RunStateById(workspace: string, runId: string): Promise<V2RunState> {
  return JSON.parse(await readFile(v2RunStateByIdPath(workspace, runId), "utf8")) as V2RunState;
}
