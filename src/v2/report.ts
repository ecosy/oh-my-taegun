import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { v2ReportPath } from "./files.js";
import type { V2RunState } from "./types.js";

export async function writeV2Report(workspace: string, state: V2RunState): Promise<string> {
  const path = v2ReportPath(workspace, state.runId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({
    runId: state.runId,
    executionModelPolicy: state.executionModelPolicy,
    ambiguityScorecard: state.ambiguityScorecard,
    convergenceSnapshot: state.convergenceSnapshot,
    pathologySignals: state.pathologySignals,
    validationSummary: state.validationSummary,
    deliveryStatus: state.deliveryStatus,
    blockedReasons: state.blockedReasons,
    verifierDecisions: state.verifierDecisions,
  }, null, 2));
  return path;
}
