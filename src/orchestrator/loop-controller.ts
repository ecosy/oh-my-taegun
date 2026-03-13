import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { appendEvidence } from "../state/evidence-store.js";
import { writeSnapshot } from "../state/snapshot-store.js";
import { executeCommands } from "../validation/execute-commands.js";
import { currentBranch } from "../delivery/git-client.js";
import { runCommand } from "../shared/command.js";
import type { BlockedReason, DocumentSet, RepositoryContext, RunState, ValidationExecutionResult } from "../shared/types.js";
import type { WorkUnitContext, WorkUnitExecutor, WorkUnitResult } from "../llm/types.js";
import { planRequirementSteps } from "../planning/requirement-step-planner.js";
import { decideRetryDirective } from "./retry-policy.js";

export interface ImplementationLoopOptions {
  documents: DocumentSet;
  repository: RepositoryContext;
  runId: string;
  runState: RunState;
  executor: WorkUnitExecutor;
}

export interface PlannedImplementationLoopOptions {
  documents: DocumentSet;
  repository: RepositoryContext;
  runId: string;
  executor: WorkUnitExecutor;
  workUnits: ReturnType<typeof planRequirementSteps>["workUnits"];
  completedRequirementIds?: string[];
  blockedRequirementIds?: string[];
  snapshotWriter?: (payload: {
    runId: string;
    iteration: number;
    workspace: string;
    acceptanceIds: string[];
    failingTests: string[];
    changedFiles: string[];
    nextActions: string[];
  }) => Promise<void>;
  eventSink?: (event: {
    type: string;
    workUnitId: string;
    attempt?: number;
    changedFiles?: string[];
    validationPassed?: boolean;
  }) => Promise<void>;
}

export interface ImplementationLoopResult {
  status: "passed" | "blocked";
  blockedReason?: BlockedReason;
  completedRequirementIds: string[];
  blockedRequirementIds: string[];
  totalWorkUnits: number;
  completedWorkUnits: number;
  currentWorkUnitId?: string;
  changedFiles: string[];
  artifacts: string[];
  evidenceRefs: string[];
  nextActions: string[];
  sessionIds: string[];
  validationArtifacts: string[];
  lastAttempt?: {
    workUnitId: string;
    sessionId?: string;
    model?: string;
    attempt: number;
  };
}

export async function executeImplementationLoop(
  options: ImplementationLoopOptions,
): Promise<ImplementationLoopResult> {
  const plan = planRequirementSteps(options.documents, {
    runId: options.runId,
    repoRoot: options.repository.localWorkspace,
    capabilities: await importCapabilities(options),
  });

  return executePlannedWorkUnits({
    documents: options.documents,
    repository: options.repository,
    runId: options.runId,
    executor: options.executor,
    workUnits: plan.workUnits,
    completedRequirementIds: options.runState.implementation?.completed_requirement_ids,
    blockedRequirementIds: options.runState.implementation?.blocked_requirement_ids,
  });
}

export async function executePlannedWorkUnits(
  options: PlannedImplementationLoopOptions,
): Promise<ImplementationLoopResult> {
  const completedRequirementIds = [...(options.completedRequirementIds ?? [])];
  const blockedRequirementIds = [...(options.blockedRequirementIds ?? [])];
  const artifacts = new Set<string>();
  const evidenceRefs = new Set<string>();
  const sessionIds = new Set<string>();
  const changedFiles = new Set<string>();
  const validationArtifacts = new Set<string>();
  const priorChangedFiles = new Set<string>();
  let completedWorkUnits = 0;
  let lastAttempt: ImplementationLoopResult["lastAttempt"];

  if (completedRequirementIds.length === 0 && await hasDirtyWorkingTree(options.repository.localWorkspace)) {
    return {
      status: "blocked",
      blockedReason: {
        code: "implementation_workspace_dirty",
        message: "Working tree is dirty before the LLM implementation loop starts.",
        requiredAction: "Clean or commit unrelated workspace changes before running implement-changes.",
        evidence: ["git status --short"],
      },
      completedRequirementIds,
      blockedRequirementIds,
      totalWorkUnits: options.workUnits.length,
      completedWorkUnits,
      changedFiles: [],
      artifacts: [],
      evidenceRefs: ["git status --short"],
      nextActions: ["Clean the workspace and rerun the implementation loop."],
      sessionIds: [],
      validationArtifacts: [],
    };
  }

  for (const unit of options.workUnits) {
    if (unit.requirementIds.every((requirementId) => completedRequirementIds.includes(requirementId))) {
      completedWorkUnits += 1;
      continue;
    }

    const unitOutcome = await executeWorkUnitWithRetries(
      unit,
      {
        documents: options.documents,
        repository: options.repository,
        executor: options.executor,
        priorChangedFiles: [...priorChangedFiles],
        snapshotWriter: options.snapshotWriter,
        eventSink: options.eventSink,
      },
    );

    unitOutcome.artifacts.forEach((artifact) => artifacts.add(artifact));
    unitOutcome.evidenceRefs.forEach((reference) => evidenceRefs.add(reference));
    unitOutcome.changedFiles.forEach((file) => {
      changedFiles.add(file);
      priorChangedFiles.add(file);
    });
    unitOutcome.validationArtifacts.forEach((artifact) => validationArtifacts.add(artifact));
    unitOutcome.sessionIds.forEach((sessionId) => sessionIds.add(sessionId));
    lastAttempt = unitOutcome.lastAttempt;

    if (unitOutcome.status === "blocked") {
      blockedRequirementIds.push(...unit.requirementIds.filter((requirementId) => !blockedRequirementIds.includes(requirementId)));
      return {
        status: "blocked",
        blockedReason: unitOutcome.blockedReason,
        completedRequirementIds,
        blockedRequirementIds,
        totalWorkUnits: options.workUnits.length,
        completedWorkUnits,
        currentWorkUnitId: unit.id,
        changedFiles: [...changedFiles],
        artifacts: [...artifacts],
        evidenceRefs: [...evidenceRefs],
        nextActions: unitOutcome.nextActions,
        sessionIds: [...sessionIds],
        validationArtifacts: [...validationArtifacts],
        lastAttempt,
      };
    }

    unit.requirementIds.forEach((requirementId) => {
      if (!completedRequirementIds.includes(requirementId)) {
        completedRequirementIds.push(requirementId);
      }
    });
    completedWorkUnits += 1;
  }

  return {
    status: "passed",
    completedRequirementIds,
    blockedRequirementIds,
    totalWorkUnits: options.workUnits.length,
    completedWorkUnits,
    changedFiles: [...changedFiles],
    artifacts: [...artifacts],
    evidenceRefs: [...evidenceRefs],
    nextActions: ["Proceed to validation gates."],
    sessionIds: [...sessionIds],
    validationArtifacts: [...validationArtifacts],
    lastAttempt,
  };
}

async function executeWorkUnitWithRetries(
  unit: ReturnType<typeof planRequirementSteps>["workUnits"][number],
  options: {
    documents: DocumentSet;
    repository: RepositoryContext;
    executor: WorkUnitExecutor;
    priorChangedFiles: string[];
    snapshotWriter?: PlannedImplementationLoopOptions["snapshotWriter"];
    eventSink?: PlannedImplementationLoopOptions["eventSink"];
  },
): Promise<{
  status: "passed" | "blocked";
  blockedReason?: BlockedReason;
  changedFiles: string[];
  artifacts: string[];
  evidenceRefs: string[];
  nextActions: string[];
  sessionIds: string[];
  validationArtifacts: string[];
  lastAttempt?: {
    workUnitId: string;
    sessionId?: string;
    model?: string;
    attempt: number;
  };
}> {
  const artifacts = new Set<string>();
  const evidenceRefs = new Set<string>();
  const sessionIds = new Set<string>();
  const validationArtifacts = new Set<string>();
  let failureEvidence: string[] = [];
  let priorSummary: string | undefined;

  for (let attempt = 1; attempt <= unit.maxAttempts; attempt += 1) {
    await writeAttemptSnapshot(unit, attempt, options, failureEvidence);
    await options.eventSink?.({
      type: "work_unit_started",
      workUnitId: unit.id,
      attempt,
    });

    const context: WorkUnitContext = {
      capabilities: await importCapabilities({ documents: options.documents, repository: options.repository } as never),
      summaryOfPriorAttempts: priorSummary,
      failureEvidence,
      changedFilesSoFar: options.priorChangedFiles,
    };
    let result: WorkUnitResult;
    try {
      result = await options.executor.execute(
        {
          ...unit,
          iteration: attempt,
        },
        context,
      );
    } catch (cause) {
      const blockedReason = {
        code: "llm_execution_failed",
        message: cause instanceof Error ? cause.message : "Codex execution failed.",
        requiredAction: "Inspect the Codex CLI failure and retry the work unit.",
        evidence: ["codex exec"],
      };
      return {
        status: "blocked",
        blockedReason,
        changedFiles: [],
        artifacts: [],
        evidenceRefs: ["codex exec"],
        nextActions: [blockedReason.requiredAction ?? "Retry the work unit."],
        sessionIds: [],
        validationArtifacts: [],
      };
    }

    result.evidenceRefs.forEach((reference) => evidenceRefs.add(reference));
    artifacts.add(result.finalMessagePath);
    artifacts.add(result.jsonEventLogPath);
    result.evidenceRefs.forEach((reference) => {
      if (reference.includes(".omt/prompts/")) {
        artifacts.add(reference);
      }
    });

    if (result.sessionId) {
      sessionIds.add(result.sessionId);
    }

    const changedFiles = result.changedFiles.length > 0
      ? result.changedFiles
      : await collectWorkingTreeFiles(options.repository.localWorkspace);
    changedFiles.forEach((file) => evidenceRefs.add(file));

    if (changedFiles.length > (unit.maxChangedFiles ?? 20)) {
      return {
        status: "blocked",
        blockedReason: {
          code: "out_of_scope_edit",
          message: `Codex changed too many files for ${unit.id}.`,
          requiredAction: "Reduce the work-unit scope or split the requirement step.",
          evidence: changedFiles,
        },
        changedFiles,
        artifacts: [...artifacts],
        evidenceRefs: [...evidenceRefs],
        nextActions: ["Reduce the scope and rerun the blocked requirement step."],
        sessionIds: [...sessionIds],
        validationArtifacts: [...validationArtifacts],
        lastAttempt: {
          workUnitId: unit.id,
          sessionId: result.sessionId,
          model: process.env.OMT_CODEX_MODEL ?? unit.model,
          attempt,
        },
      };
    }

    const validation = await executeCommands(unit.validationCommands, options.repository.localWorkspace);
    const validationArtifact = validationArtifactPath(options.repository.localWorkspace, unit.runId, unit.id);
    await mkdir(dirname(validationArtifact), { recursive: true });
    await writeFile(validationArtifact, JSON.stringify({ attempt, validation }, null, 2));
    validationArtifacts.add(validationArtifact);
    artifacts.add(validationArtifact);
    await options.eventSink?.({
      type: "work_unit_completed",
      workUnitId: unit.id,
      attempt,
      changedFiles,
      validationPassed: validation.passed,
    });

    await appendEvidence(options.repository.localWorkspace, {
      id: `${unit.id}-attempt-${attempt}`,
      source_type: "runtime",
      ref: unit.id,
      summary: `${result.status} / validation=${validation.passed}`,
      recorded_at: new Date().toISOString(),
    });

    const directive = decideRetryDirective({
      attempt,
      maxAttempts: unit.maxAttempts,
      status: result.status,
      validationPassed: validation.passed,
    });

    if (directive.action === "complete") {
      return {
        status: "passed",
        changedFiles,
        artifacts: [...artifacts],
        evidenceRefs: [...evidenceRefs],
        nextActions: ["Move to the next requirement step."],
        sessionIds: [...sessionIds],
        validationArtifacts: [...validationArtifacts],
        lastAttempt: {
          workUnitId: unit.id,
          sessionId: result.sessionId,
          model: process.env.OMT_CODEX_MODEL ?? unit.model,
          attempt,
        },
      };
    }

    if (directive.action === "blocked") {
      return {
        status: "blocked",
        blockedReason: {
          code: result.status === "no_change" ? "llm_no_progress" : "validation_failed",
          message: result.status === "no_change"
            ? `Work unit ${unit.id} reported no change across all retry attempts.`
            : `Work unit ${unit.id} failed validation after ${attempt} attempt(s).`,
          requiredAction: "Inspect validation failures and rerun the requirement step.",
          evidence: [
            ...validation.issues,
            ...result.unresolvedItems,
          ],
        },
        changedFiles,
        artifacts: [...artifacts],
        evidenceRefs: [...evidenceRefs],
        nextActions: ["Inspect failing validation output and retry manually or on resume."],
        sessionIds: [...sessionIds],
        validationArtifacts: [...validationArtifacts],
        lastAttempt: {
          workUnitId: unit.id,
          sessionId: result.sessionId,
          attempt,
        },
      };
    }

    priorSummary = result.summary;
    failureEvidence = [
      ...validation.issues,
      ...result.unresolvedItems,
    ];
  }

  return {
    status: "blocked",
    blockedReason: {
      code: "llm_retry_exhausted",
      message: `Work unit ${unit.id} exhausted its retry budget.`,
      requiredAction: "Inspect the work unit artifacts and retry from a clean checkpoint.",
    },
    changedFiles: [],
    artifacts: [...artifacts],
    evidenceRefs: [...evidenceRefs],
    nextActions: ["Inspect the work unit artifacts and retry."],
    sessionIds: [...sessionIds],
    validationArtifacts: [...validationArtifacts],
  };
}

async function collectWorkingTreeFiles(workspace: string): Promise<string[]> {
  const status = await runCommand("git", ["-C", workspace, "status", "--porcelain"]);
  return status.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .filter((file) => !file.startsWith(".omt/"));
}

async function hasDirtyWorkingTree(workspace: string): Promise<boolean> {
  const files = await collectWorkingTreeFiles(workspace);
  return files.length > 0;
}

function validationArtifactPath(workspace: string, runId: string, workUnitId: string): string {
  return join(workspace, ".omt", "validation", runId, `${workUnitId}.json`);
}

async function importCapabilities(options: Pick<ImplementationLoopOptions, "documents" | "repository">): Promise<ImplementationLoopOptions["documents"]["profile"] extends never ? never : import("../shared/types.js").CapabilityReport> {
  return (await import("../intake/detect-capabilities.js")).detectCapabilities(options.repository.localWorkspace);
}

async function writeAttemptSnapshot(
  unit: ReturnType<typeof planRequirementSteps>["workUnits"][number],
  attempt: number,
  options: {
    repository: RepositoryContext;
    priorChangedFiles: string[];
    snapshotWriter?: PlannedImplementationLoopOptions["snapshotWriter"];
  },
  failureEvidence: string[],
): Promise<void> {
  if (options.snapshotWriter) {
    await options.snapshotWriter({
      runId: unit.runId,
      iteration: unit.iteration * 10 + attempt,
      workspace: options.repository.localWorkspace,
      acceptanceIds: unit.acceptanceIds,
      failingTests: failureEvidence,
      changedFiles: options.priorChangedFiles,
      nextActions: [`Execute ${unit.id} attempt ${attempt}.`],
    });
    return;
  }

  const branch = await currentBranch(options.repository.localWorkspace).catch(() => "main");
  await writeSnapshot(options.repository.localWorkspace, {
    run_id: unit.runId,
    iteration: unit.iteration * 10 + attempt,
    created_at: new Date().toISOString(),
    branch,
    workspace: options.repository.localWorkspace,
    ac_status: Object.fromEntries(unit.acceptanceIds.map((acceptanceId) => [acceptanceId, "pending"])),
    failing_tests: failureEvidence,
    changed_files: options.priorChangedFiles,
    blockers: [],
    next_actions: [`Execute ${unit.id} attempt ${attempt}.`],
    validation_summary: {},
  });
}
