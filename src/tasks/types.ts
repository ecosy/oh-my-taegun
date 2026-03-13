import type {
  BlockedReason,
  CapabilityReport,
  DocumentSet,
  RepositoryContext,
  RunState,
  SnapshotState,
  TaskResult,
  ValidationExecutionResult,
} from "../shared/types.js";

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

export interface ImplementationTaskPayload {
  totalWorkUnits: number;
  completedWorkUnits: number;
  currentWorkUnitId?: string;
  completedRequirementIds: string[];
  blockedRequirementIds: string[];
  changedFiles: string[];
  sessionIds: string[];
  validationArtifacts: string[];
  lastAttempt?: {
    workUnitId: string;
    sessionId?: string;
    model?: string;
    attempt: number;
  };
}

export interface ValidationTaskPayload {
  featureValidation: ValidationExecutionResult;
  regressionValidation: ValidationExecutionResult;
}

export interface TaskExecutionOutput extends TaskResult {
  capabilities?: CapabilityReport;
  repository?: RepositoryContext;
  runState?: RunState;
  delivery?: DeliveryTaskPayload;
  implementation?: ImplementationTaskPayload;
  validation?: ValidationTaskPayload;
}

export interface ExecutableTask {
  readonly id: string;
  execute(context: TaskExecutionContext): Promise<TaskExecutionOutput>;
}
