import type { BlockedReason, CapabilityReport, DocumentSet, RepositoryContext, RunState, SnapshotState, TaskResult } from "../shared/types.js";

export interface TaskExecutionContext {
  documents: DocumentSet;
  repository: RepositoryContext;
  capabilities: CapabilityReport;
  runId: string;
  featureBranch: string;
  targetBranch: string;
  runState?: RunState;
  snapshot?: SnapshotState;
}

export interface DeliveryTaskPayload {
  blockedReasons: BlockedReason[];
  remotePushed: boolean;
  prUrl?: string;
}

export interface TaskExecutionOutput extends TaskResult {
  capabilities?: CapabilityReport;
  repository?: RepositoryContext;
  runState?: RunState;
  delivery?: DeliveryTaskPayload;
}

export interface ExecutableTask {
  readonly id: string;
  execute(context: TaskExecutionContext): Promise<TaskExecutionOutput>;
}
