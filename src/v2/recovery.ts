import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { latestV2Snapshot } from "./snapshot-store.js";
import { readEvents, replayEvents } from "./event-store.js";
import { v2HandoffPath } from "./files.js";
import type { DeliveryPolicy, ExecutionModelPolicy, ReviewerDecision } from "./types.js";

export async function writeV2Handoff(
  workspace: string,
  runId: string,
  content: string,
): Promise<string> {
  const path = v2HandoffPath(workspace, runId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return path;
}

export async function latestV2Handoff(workspace: string, runId: string): Promise<string | null> {
  return readFile(v2HandoffPath(workspace, runId), "utf8").catch(() => null);
}

export async function prepareV2Resume(workspace: string, runId: string): Promise<{
  phase: string;
  executionModelPolicy?: ExecutionModelPolicy;
  deliveryPolicy?: DeliveryPolicy;
  reviewerDecision?: ReviewerDecision;
  snapshot: Awaited<ReturnType<typeof latestV2Snapshot>>;
  handoff: string | null;
  nextActions: string[];
}> {
  const replay = replayEvents(await readEvents(workspace, runId));
  const snapshot = await latestV2Snapshot(workspace, runId);
  const handoff = await latestV2Handoff(workspace, runId);

  return {
    phase: replay.phase,
    executionModelPolicy: replay.executionModelPolicy,
    deliveryPolicy: replay.deliveryPolicy,
    reviewerDecision: replay.reviewerDecision,
    snapshot,
    handoff,
    nextActions: replay.blockedReasons.length > 0
      ? replay.blockedReasons
      : ["Continue from the recorded phase and consult the latest report for delivery readiness."],
  };
}
