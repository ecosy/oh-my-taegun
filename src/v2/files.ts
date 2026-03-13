import { join } from "node:path";

export function v2Root(workspace: string): string {
  return join(workspace, ".omt", "v2");
}

export function v2DesignDir(workspace: string): string {
  return join(v2Root(workspace), "design");
}

export function v2DesignModelSurveyPath(workspace: string): string {
  return join(v2DesignDir(workspace), "model-survey.json");
}

export function v2DesignInterviewPath(workspace: string): string {
  return join(v2DesignDir(workspace), "interview.jsonl");
}

export function v2OntologyPath(workspace: string): string {
  return join(v2DesignDir(workspace), "ontology.json");
}

export function v2SeedPath(workspace: string): string {
  return join(v2DesignDir(workspace), "seed.json");
}

export function v2EventLogPath(workspace: string, runId: string): string {
  return join(v2Root(workspace), "events", `${runId}.jsonl`);
}

export function v2RunStatePath(workspace: string): string {
  return join(v2Root(workspace), "state", "run.json");
}

export function v2RunStateByIdPath(workspace: string, runId: string): string {
  return join(v2Root(workspace), "state", "runs", `${runId}.json`);
}

export function v2SnapshotDir(workspace: string, runId: string): string {
  return join(v2Root(workspace), "snapshots", runId);
}

export function v2SnapshotPath(workspace: string, runId: string, iteration: number): string {
  return join(v2SnapshotDir(workspace, runId), `snapshot-${iteration}.json`);
}

export function v2ReportPath(workspace: string, runId: string): string {
  return join(v2Root(workspace), "reports", `${runId}.json`);
}

export function v2HandoffDir(workspace: string, runId: string): string {
  return join(v2Root(workspace), "handoffs", runId);
}

export function v2HandoffPath(workspace: string, runId: string): string {
  return join(v2HandoffDir(workspace, runId), "handoff.md");
}
