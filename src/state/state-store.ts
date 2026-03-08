import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RunState, TaskState } from "../shared/types.js";

async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export function runStatePath(workspace: string): string {
  return join(workspace, ".omt", "state", "run.json");
}

export function historicalRunStatePath(workspace: string, runId: string): string {
  return join(workspace, ".omt", "state", "runs", `${runId}.json`);
}

export function taskStatePath(workspace: string, taskId: string): string {
  return join(workspace, ".omt", "state", "tasks", `${taskId}.json`);
}

export async function writeRunState(workspace: string, state: RunState): Promise<string> {
  const path = runStatePath(workspace);
  const historicalPath = historicalRunStatePath(workspace, state.run_id);
  await ensureParent(path);
  await ensureParent(historicalPath);
  await writeFile(path, JSON.stringify(state, null, 2));
  await writeFile(historicalPath, JSON.stringify(state, null, 2));
  return path;
}

export async function readRunState(workspace: string): Promise<RunState> {
  const raw = await readFile(runStatePath(workspace), "utf8");
  return JSON.parse(raw) as RunState;
}

export async function readRunStateById(workspace: string, runId: string): Promise<RunState> {
  const raw = await readFile(historicalRunStatePath(workspace, runId), "utf8");
  return JSON.parse(raw) as RunState;
}

export async function writeTaskState(workspace: string, state: TaskState): Promise<string> {
  const path = taskStatePath(workspace, state.task_id);
  await ensureParent(path);
  await writeFile(path, JSON.stringify(state, null, 2));
  return path;
}

export async function readTaskState(workspace: string, taskId: string): Promise<TaskState> {
  const raw = await readFile(taskStatePath(workspace, taskId), "utf8");
  return JSON.parse(raw) as TaskState;
}
