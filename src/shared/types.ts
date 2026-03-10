export type TaskStatus = "pending" | "running" | "passed" | "failed" | "blocked";
export type RunStatus = "planning" | "running" | "blocked" | "completed" | "failed";
export type DeliveryMode = "dry-run" | "draft-pr" | "real-pr";

export interface Requirement {
  id: string;
  priority: "MUST" | "SHOULD" | "COULD";
  title: string;
  description: string;
  source_refs: string[];
}

export interface AcceptanceCriterion {
  id: string;
  requirement_ids: string[];
  title: string;
  description: string;
  verification: Record<string, unknown>;
}

export interface TestPlanItem {
  id: string;
  acceptance_ids: string[];
  category: string;
  method: string;
  stage: string;
  description: string;
}

export interface TaskContract {
  type: string;
  inputs?: string[];
  outputs?: string[];
  preconditions?: string[];
  blocked_when?: string[];
}

export interface LlmExecutionProfile {
  backend?: "codex-cli" | string;
  model?: string;
  work_unit_strategy?: "requirement-step" | string;
  edit_mode?: "direct-edit" | string;
  execution_scope?: "code-and-test" | string;
  per_unit_max_attempts?: number;
  include_should_requirements?: boolean;
  codex?: {
    sandbox?: "read-only" | "workspace-write" | "danger-full-access" | string;
    approval?: "untrusted" | "on-failure" | "on-request" | "never" | string;
    json_output?: boolean;
  };
}

export interface SpecProfile {
  version: number;
  profile_id: string;
  product_id: string;
  source_documents: Record<string, string>;
  inputs?: Record<string, unknown>;
  planning?: Record<string, unknown>;
  capability_detection?: Record<string, unknown>;
  execution?: {
    mode?: string;
    blocked_when?: string[];
    high_risk_actions?: Record<string, unknown>;
  };
  validation?: {
    required?: string[];
    gate_order?: string[];
  };
  delivery?: {
    target_outcome?: DeliveryMode | string;
    fallback_on_remote_failure?: string;
    branch_strategy?: {
      feature_branch_template?: string;
      target_branch?: string;
      update_existing_branch_if_present?: boolean;
    };
    idempotency_key?: string;
  };
  llm_execution?: LlmExecutionProfile;
  tasks: Array<{ id: string; type: string; depends_on?: string[]; workspace_mode?: string }>;
}

export interface DocumentSet {
  projectRoot: string;
  docsRoot: string;
  profile: SpecProfile;
  requirements: { requirements: Requirement[] };
  acceptance: { acceptance_criteria: AcceptanceCriterion[] };
  testPlan: { test_plan: TestPlanItem[] };
  taskContracts: { task_contracts: TaskContract[] };
  stateSchema: Record<string, unknown>;
  testMatrix: Record<string, unknown>;
}

export interface RepositoryInput {
  gitUrl?: string;
  repoPath?: string;
  workingRoot: string;
}

export interface RepositoryContext {
  canonicalRepoId: string;
  localWorkspace: string;
  defaultBranch: string;
  originUrl?: string;
}

export interface CapabilityReport {
  classification: "supported" | "partial" | "blocked";
  languages: string[];
  runtime: string | null;
  packageManager: string | null;
  buildCommands: string[];
  testCommands: string[];
  lintCommands: string[];
  typecheckCommands: string[];
  deploymentTargets: string[];
  secretRequirements: string[];
  externalWriteSurfaces: string[];
  notes: string[];
}

export interface ValidationExecutionResult {
  passed: boolean;
  commands: string[];
  outputs: Array<{
    command: string;
    passed: boolean;
    stdout: string;
    stderr: string;
  }>;
  issues: string[];
}

export interface BlockedReason {
  code: string;
  message: string;
  requiredAction?: string;
  evidence?: string[];
}

export interface TaskResult {
  status: Exclude<TaskStatus, "pending" | "running">;
  artifacts: string[];
  evidenceRefs: string[];
  nextActions: string[];
  blockedReason?: BlockedReason;
}

export interface RunState {
  run_id: string;
  profile_id: string;
  status: RunStatus;
  started_at: string;
  updated_at: string;
  repository: {
    canonical_repo_id: string;
    local_workspace: string;
    default_branch: string;
  };
  current_task: string;
  completed_tasks: string[];
  blocked_reasons: BlockedReason[];
  delivery: {
    mode: DeliveryMode;
    status: "pending" | "blocked" | "completed";
    target_branch: string;
    feature_branch: string;
    pr_url?: string;
    remote_pushed?: boolean;
  };
  validation: {
    traceability: boolean;
    feature_validation: boolean;
    regression_validation: boolean;
  };
  implementation?: {
    total_work_units: number;
    completed_work_units: number;
    current_work_unit_id?: string;
    completed_requirement_ids: string[];
    blocked_requirement_ids: string[];
  };
}

export interface TaskState {
  task_id: string;
  run_id: string;
  status: TaskStatus;
  attempts: number;
  started_at?: string;
  completed_at?: string;
  artifacts: string[];
  evidence_refs: string[];
  next_actions: string[];
  blocked_reason?: BlockedReason;
  llm?: {
    backend: "codex-cli";
    work_unit_id?: string;
    session_id?: string;
    model?: string;
    attempt?: number;
  };
}

export interface SnapshotState {
  run_id: string;
  iteration: number;
  created_at: string;
  branch: string;
  workspace: string;
  ac_status: Record<string, "pass" | "fail" | "blocked" | "pending">;
  failing_tests: string[];
  changed_files: string[];
  blockers: string[];
  next_actions: string[];
  validation_summary: Record<string, boolean>;
}

export interface EvidenceEntry {
  id: string;
  source_type: "user" | "repo" | "command" | "external" | "runtime";
  ref: string;
  summary: string;
  recorded_at: string;
}

export interface PullRequestResult {
  url: string;
  number: number;
  existing: boolean;
}
