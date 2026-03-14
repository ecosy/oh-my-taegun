import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { v2EventLogPath } from "./files.js";
import type { DeliveryPolicy, EventRecord, ExecutionModelPolicy, ReviewerDecision, V2Phase } from "./types.js";

export async function appendEvent(workspace: string, runId: string, event: Omit<EventRecord, "runId" | "timestamp">): Promise<string> {
  const path = v2EventLogPath(workspace, runId);
  await mkdir(dirname(path), { recursive: true });
  const record: EventRecord = {
    runId,
    phase: event.phase,
    type: event.type,
    timestamp: new Date().toISOString(),
    payload: event.payload,
  };
  const prior = await readFile(path, "utf8").catch(() => "");
  await writeFile(path, `${prior}${JSON.stringify(record)}\n`);
  return path;
}

export async function readEvents(workspace: string, runId: string): Promise<EventRecord[]> {
  const raw = await readFile(v2EventLogPath(workspace, runId), "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EventRecord);
}

export function replayEvents(events: EventRecord[]): {
  phase: V2Phase;
  executionModelPolicy?: ExecutionModelPolicy;
  deliveryPolicy?: DeliveryPolicy;
  reviewerDecision?: ReviewerDecision;
  lastSnapshotIteration?: number;
  blockedReasons: string[];
} {
  let phase: V2Phase = "design";
  let executionModelPolicy: ExecutionModelPolicy | undefined;
  let deliveryPolicy: DeliveryPolicy | undefined;
  let reviewerDecision: ReviewerDecision | undefined;
  let lastSnapshotIteration: number | undefined;
  const blockedReasons: string[] = [];

  for (const event of events) {
    phase = event.phase;
    if (event.type === "model_policy_confirmed" && event.payload.executionModelPolicy) {
      executionModelPolicy = event.payload.executionModelPolicy as ExecutionModelPolicy;
      deliveryPolicy = event.payload.deliveryPolicy as DeliveryPolicy | undefined;
    }
    if (event.type === "snapshot_written" && typeof event.payload.iteration === "number") {
      lastSnapshotIteration = event.payload.iteration;
    }
    if (event.type === "review_completed" && event.payload.status) {
      reviewerDecision = event.payload as unknown as ReviewerDecision;
    }
    if (event.type === "blocked_raised" && typeof event.payload.message === "string") {
      blockedReasons.push(event.payload.message);
    }
  }

  return {
    phase,
    executionModelPolicy,
    deliveryPolicy,
    reviewerDecision,
    lastSnapshotIteration,
    blockedReasons,
  };
}
