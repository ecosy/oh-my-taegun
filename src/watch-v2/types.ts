export type RequirementWatchStatus = "pending" | "active" | "changed" | "validated" | "blocked";
export type WatchPhase = "design" | "plan" | "execute" | "verify" | "review" | "deliver" | "idle" | "blocked";

export interface ReplayHint {
  levelId: string;
  title: string;
  seed: number | null;
  command: string;
  artifactPath: string | null;
}

export interface WatchSnapshot {
  repoPath: string;
  runId: string | null;
  phase: WatchPhase;
  currentStage: string | null;
  completedStages: string[];
  modelPolicy: {
    surveyedModels: string[];
    approvedModels: string[];
    defaultDesignModel: string | null;
    defaultExecutionModel: string | null;
    defaultVerifierModel: string | null;
    workUnitBudgetProfile: string | null;
  } | null;
  currentWorkUnit: {
    workUnitId: string;
    requirementIds: string[];
    acceptanceIds: string[];
    attempt: number | null;
  } | null;
  requirementStatuses: Array<{
    requirementId: string;
    title: string;
    status: RequirementWatchStatus;
  }>;
  latestEvents: Array<{
    timestamp: string;
    phase: string;
    type: string;
    payload: unknown;
  }>;
  changedFiles: string[];
  validation: {
    featurePassed: boolean | null;
    regressionPassed: boolean | null;
    deliveryStatus: string | null;
    deliveryReadiness: string | null;
  };
  replayHints: ReplayHint[];
  artifactPaths: {
    designSeed: string | null;
    eventLog: string | null;
    report: string | null;
    evalSummary: string | null;
    replaySummary: string | null;
  };
  warnings: string[];
}
