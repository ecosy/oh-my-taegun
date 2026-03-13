import type { CapabilityReport, LlmExecutionProfile } from "../shared/types.js";

export interface WorkUnit {
  id: string;
  runId: string;
  iteration: number;
  requirementIds: string[];
  acceptanceIds: string[];
  testPlanIds: string[];
  title: string;
  objective: string;
  repoRoot: string;
  validationCommands: string[];
  constraints: string[];
  editMode: "direct-edit";
  executionScope: "code-and-test";
  model: string;
  maxAttempts: number;
  maxChangedFiles?: number;
  budgetProfile?: string;
}

export interface WorkUnitContext {
  capabilities: CapabilityReport;
  summaryOfPriorAttempts?: string;
  failureEvidence?: string[];
  changedFilesSoFar?: string[];
}

export interface WorkUnitResult {
  status: "changed" | "no_change" | "blocked" | "failed";
  summary: string;
  changedFiles: string[];
  suggestedValidationCommands: string[];
  unresolvedItems: string[];
  evidenceRefs: string[];
  sessionId?: string;
  finalMessagePath: string;
  jsonEventLogPath: string;
}

export interface WorkUnitExecutor {
  execute(unit: WorkUnit, context: WorkUnitContext): Promise<WorkUnitResult>;
}

export interface RequirementStepPlan {
  workUnits: WorkUnit[];
  selectedRequirementIds: string[];
  blockedReasons?: string[];
}

export interface LlmRuntimeSettings {
  backend: "codex-cli";
  model: string;
  workUnitStrategy: "requirement-step";
  editMode: "direct-edit";
  executionScope: "code-and-test";
  perUnitMaxAttempts: number;
  includeShouldRequirements: boolean;
  codex: {
    sandbox: "workspace-write";
    approval: "never";
    jsonOutput: true;
  };
}

export function resolveLlmRuntimeSettings(profile?: LlmExecutionProfile): LlmRuntimeSettings {
  return {
    backend: "codex-cli",
    model: profile?.model ?? "gpt-5.4",
    workUnitStrategy: "requirement-step",
    editMode: "direct-edit",
    executionScope: "code-and-test",
    perUnitMaxAttempts: profile?.per_unit_max_attempts ?? 3,
    includeShouldRequirements: profile?.include_should_requirements ?? false,
    codex: {
      sandbox: "workspace-write",
      approval: "never",
      jsonOutput: true,
    },
  };
}
