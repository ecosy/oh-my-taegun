import type { BlockedReason, CapabilityReport, DocumentSet, RepositoryContext, ValidationExecutionResult } from "../shared/types.js";

export type V2Phase = "doctor" | "design" | "plan" | "execute" | "verify" | "review" | "deliver";
export type DeliveryTargetStage = "dry-run" | "commit" | "real-pr" | "dev" | "prod";
export type StageRunnerKind = "shell" | "external-command";

export interface ModelPolicyInput {
  surveyModels?: string;
  approvedModels?: string;
  designModel?: string;
  executionModel?: string;
  verifierModel?: string;
  reasoningEfforts?: string;
  fallbackChain?: string;
  workUnitBudgetProfile?: string;
}

export interface ModelEnvironmentSurvey {
  surveyedAt: string;
  surveyedModels: string[];
  approvedModels: string[];
  reasoningEfforts: string[];
  constraints: string[];
  verifierModelAllowed: boolean;
  source: "cli" | "env" | "fallback";
}

export interface ModelFallbackChain {
  models: string[];
}

export interface WorkUnitBudget {
  profile: string;
  maxRequirementIds: number;
  maxAcceptanceIds: number;
  maxChangedFiles: number;
  maxValidationCommands: number;
  maxAttempts: number;
  maxOpenQuestionsPerRound: number;
}

export interface ExecutionModelPolicy {
  surveyedModels: string[];
  approvedModels: string[];
  defaultDesignModel?: string;
  defaultExecutionModel?: string;
  defaultVerifierModel?: string;
  allowedReasoningEfforts: string[];
  fallbackChain: ModelFallbackChain;
  maxAttemptsByPhase: Record<string, number>;
  workUnitBudgetProfile: string;
  workUnitBudget: WorkUnitBudget;
  requiresManualOverrideFor: string[];
  recordedAt: string;
  openQuestions: string[];
}

export interface DeliveryCommandPolicy {
  runnerKind: StageRunnerKind;
  command: string;
  validationCommand?: string;
  envRefs: string[];
}

export interface DeliveryPolicyInput {
  targetStage?: DeliveryTargetStage;
  reviewRequired?: boolean;
  realPr?: {
    targetBranch?: string;
    featureBranchTemplate?: string;
    titleTemplate?: string;
  };
  dev?: Partial<DeliveryCommandPolicy>;
  prod?: Partial<DeliveryCommandPolicy> & {
    approvedForThisRun?: boolean;
  };
  fallbackMode?: "blocked-handoff";
}

export interface DeliveryPolicy {
  targetStage: DeliveryTargetStage;
  reviewRequired: boolean;
  fallbackMode: "blocked-handoff";
  realPr: {
    targetBranch: string;
    featureBranchTemplate: string;
    titleTemplate: string;
  };
  dev?: DeliveryCommandPolicy;
  prod?: DeliveryCommandPolicy & {
    approvedForThisRun: boolean;
  };
  openQuestions: string[];
}

export interface InterviewAnswerFile {
  modelPolicy?: ModelPolicyInput;
  deliveryPolicy?: DeliveryPolicyInput;
}

export interface QuestionRecord {
  id: string;
  question: string;
  answer?: string;
  required: boolean;
  source: "doctor" | "operator" | "system";
  slot?: string;
  status?: "answered" | "unanswered" | "assumed" | "verified";
  blocking?: boolean;
}

export interface AmbiguityScorecard {
  threshold: number;
  score: number;
  slots: Record<string, number>;
  slotStatus?: Record<string, QuestionRecord["status"]>;
  openQuestions: string[];
  assumptionsUsed?: string[];
  blockingQuestions?: string[];
  passed: boolean;
}

export interface OntologyNode {
  name: string;
  kind: "requirement" | "acceptance" | "capability" | "policy";
  refs: string[];
}

export interface OntologySeed {
  generatedAt: string;
  nodes: OntologyNode[];
  designSummary: string;
}

export interface ConvergenceSnapshot {
  generatedAt: string;
  similarity: number;
  threshold: number;
  converged: boolean;
  ontologyDriftDetected: boolean;
  driftCategories?: Array<"missing_requirement" | "missing_acceptance" | "policy_shift" | "unexplained_new_scope">;
  missingCoverage?: string[];
  replanSuggested?: boolean;
}

export interface PathologySignal {
  type: "stagnation" | "oscillation" | "repetitive_feedback" | "retry_without_new_evidence";
  detected: boolean;
  evidence: string[];
}

export interface VerifierDecision {
  id: "verifier_pass" | "verifier_replan" | "verifier_block";
  passed: boolean;
  reasons: string[];
}

export interface ReviewerDecision {
  status: "pass" | "rework" | "block";
  summary: string;
  findings: string[];
  nextActions: string[];
  evidenceRefs: string[];
}

export interface VerifiedCapabilityBucket {
  buildCommands: string[];
  testCommands: string[];
  lintCommands: string[];
  typecheckCommands: string[];
  deploymentTargets: string[];
  secretRequirements: string[];
  externalWriteSurfaces: string[];
  reasons?: string[];
}

export interface DeliveryBlockingCheck {
  code: string;
  passed: boolean;
  message: string;
}

export interface PreflightCheck {
  code: string;
  passed: boolean;
  message: string;
}

export interface CredentialGap {
  code: string;
  message: string;
  severity: "warning" | "blocking";
}

export interface VerifiedCapabilityReport {
  classification: CapabilityReport["classification"];
  runtime: string | null;
  packageManager: string | null;
  languages: string[];
  verified: VerifiedCapabilityBucket;
  unverified: VerifiedCapabilityBucket;
  notes: string[];
  evidenceRefs: string[];
  allowlistUsed: string[];
}

export interface EventRecord {
  runId: string;
  phase: V2Phase;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface DesignPackage {
  repository: RepositoryContext;
  verifiedCapabilityReport: VerifiedCapabilityReport;
  executionModelPolicy: ExecutionModelPolicy;
  deliveryPolicy: DeliveryPolicy;
  ambiguityScorecard: AmbiguityScorecard;
  ontologySeed: OntologySeed;
  openQuestionCount: number;
  approvalRecord: {
    frozen: boolean;
    blockedReasons: BlockedReason[];
  };
}

export interface V2RunState {
  runId: string;
  profileVersion: 2;
  repository: RepositoryContext;
  status: "planning" | "running" | "blocked" | "completed";
  phase: V2Phase;
  startedAt: string;
  updatedAt: string;
  executionModelPolicy: ExecutionModelPolicy;
  deliveryPolicy: DeliveryPolicy;
  ambiguityScorecard: AmbiguityScorecard;
  convergenceSnapshot?: ConvergenceSnapshot;
  pathologySignals: PathologySignal[];
  blockedReasons: BlockedReason[];
  verifierDecisions: VerifierDecision[];
  reviewerDecision?: ReviewerDecision;
  validationSummary: {
    featureValidation: ValidationExecutionResult;
    regressionValidation: ValidationExecutionResult;
  };
  deliveryStatus: {
    mode: DeliveryTargetStage;
    status: "pending" | "blocked" | "completed";
    featureBranch?: string;
    targetBranch?: string;
    prUrl?: string;
    localCommitSha?: string;
    targetStage: DeliveryTargetStage;
    currentStage: DeliveryTargetStage;
    completedStages: DeliveryTargetStage[];
    failedStage?: DeliveryTargetStage;
    stageResults: Array<{
      stage: DeliveryTargetStage;
      status: "pending" | "completed" | "blocked" | "skipped";
      command?: string;
      validationCommand?: string;
      runnerKind?: StageRunnerKind;
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      durationMs?: number;
      cwd?: string;
      evidenceRefs: string[];
      nextActions: string[];
    }>;
    deliveryReadiness: "dry-run-ready" | "stage-complete" | "blocked-on-validation" | "blocked-on-capability" | "blocked-on-policy" | "blocked-on-review";
    blockingChecks: DeliveryBlockingCheck[];
    nextActions: string[];
  };
}

export interface DoctorResult {
  repository: RepositoryContext;
  modelEnvironmentSurvey: ModelEnvironmentSurvey;
  gitRuntimeContext: {
    workingTreeClean: boolean;
    currentBranch?: string;
  };
  preflightChecks: PreflightCheck[];
  credentialGaps: CredentialGap[];
  verifiedCapabilityReport: VerifiedCapabilityReport;
}

export interface V2RunOutcome {
  runState: V2RunState;
  reportPath: string;
}

export interface V2Context {
  documents: DocumentSet;
  repository: RepositoryContext;
}
