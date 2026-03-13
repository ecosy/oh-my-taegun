import { basename } from "node:path";
import { loadDocuments } from "../config/load-documents.js";
import { detectCapabilities } from "../intake/detect-capabilities.js";
import { resolveRepository } from "../intake/resolve-repo.js";
import { appendEvidence } from "../state/evidence-store.js";
import { writeHandoff } from "../state/handoff-store.js";
import { writeSnapshot } from "../state/snapshot-store.js";
import { writeRunState, writeTaskState } from "../state/state-store.js";
import { currentBranch, ensureFeatureBranch } from "../delivery/git-client.js";
import { writeBlockedReport } from "../delivery/blocked-report.js";
import { attemptDelivery } from "./delivery.js";
import { createTask } from "./task-dispatcher.js";
import { evaluateTraceability } from "../validation/traceability-gate.js";
import { evaluateDeliveryGate } from "../validation/delivery-gate.js";
import type { BlockedReason, RunState, TaskState } from "../shared/types.js";
import type { TaskExecutionOutput } from "../tasks/types.js";

export interface RunOptions {
  projectRoot: string;
  profilePath?: string;
  gitUrl?: string;
  repoPath?: string;
}

export interface RunOutcome {
  runState: RunState;
  blockedReportPath?: string;
}

export async function runNightly(options: RunOptions): Promise<RunOutcome> {
  const documents = await loadDocuments(options.projectRoot, options.profilePath);
  const repository = await resolveRepository({
    gitUrl: options.gitUrl,
    repoPath: options.repoPath,
    workingRoot: options.projectRoot,
  });
  const capabilities = await detectCapabilities(repository.localWorkspace);
  const traceability = evaluateTraceability(documents);
  const featureBranch = `feature/omt-${createRunId()}`;
  const runId = featureBranch.replace("feature/omt-", "");
  const deliveryMode = documents.profile.delivery?.target_outcome === "real-pr" ? "real-pr" : "dry-run";
  const targetBranch = documents.profile.delivery?.branch_strategy?.target_branch ?? "develop";

  await ensureFeatureBranch(repository.localWorkspace, featureBranch).catch(() => undefined);
  const branch = await currentBranch(repository.localWorkspace).catch(async () => featureBranch);

  const initialRunState: RunState = {
    run_id: runId,
    profile_id: documents.profile.profile_id,
    status: "running",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    repository: {
      canonical_repo_id: repository.canonicalRepoId,
      local_workspace: repository.localWorkspace,
      default_branch: repository.defaultBranch,
    },
    current_task: "repo-intake",
    completed_tasks: [],
    blocked_reasons: [],
    delivery: {
      mode: deliveryMode,
      status: "pending",
      target_branch: targetBranch,
      feature_branch: branch,
    },
    validation: {
      traceability: traceability.passed,
      feature_validation: false,
      regression_validation: false,
    },
    implementation: {
      total_work_units: 0,
      completed_work_units: 0,
      completed_requirement_ids: [],
      blocked_requirement_ids: [],
    },
  };

  const coreTaskResults = await runTasks({
    orderedTaskIds: [
      "repo-intake",
      "capability-discovery",
      "interactive-design",
      "freeze-scope",
      "implement-changes",
      "run-validation",
    ],
    documents,
    repository,
    capabilities,
    runId,
    featureBranch: branch,
    targetBranch,
    runState: initialRunState,
  });

  const implementationResult = coreTaskResults.find((result) => result.taskId === "implement-changes")?.output.implementation;
  const validationResult = coreTaskResults.find((result) => result.taskId === "run-validation")?.output.validation;
  const featureValidation = validationResult?.featureValidation ?? {
    passed: false,
    commands: [],
    outputs: [],
    issues: ["Feature validation did not execute."],
  };
  const regressionValidation = validationResult?.regressionValidation ?? {
    passed: false,
    commands: [],
    outputs: [],
    issues: ["Regression validation did not execute."],
  };
  const deliveryGate = evaluateDeliveryGate({
    deliveryMode,
    originUrl: repository.originUrl,
    targetBranch,
    featureBranch: branch,
    featureValidationPassed: featureValidation.passed,
    regressionValidationPassed: regressionValidation.passed,
    capabilities,
  });

  const taskBlockedReasons = coreTaskResults
    .map((result) => result.output.blockedReason)
    .filter((reason): reason is BlockedReason => Boolean(reason));
  const blockedReasons = collectBlockedReasons({
    traceability,
    featureIssues: featureValidation.issues,
    regressionIssues: regressionValidation.issues,
    deliveryIssues: deliveryGate.issues,
    taskBlockedReasons,
  });

  const draftRunState: RunState = {
    ...initialRunState,
    updated_at: new Date().toISOString(),
    current_task: blockedReasons.length > 0 ? (taskBlockedReasons[0]?.code.startsWith("delivery") ? "deliver" : "run-validation") : "deliver",
    blocked_reasons: blockedReasons,
    validation: {
      traceability: traceability.passed,
      feature_validation: featureValidation.passed,
      regression_validation: regressionValidation.passed,
    },
    implementation: implementationResult
      ? {
        total_work_units: implementationResult.totalWorkUnits,
        completed_work_units: implementationResult.completedWorkUnits,
        current_work_unit_id: implementationResult.currentWorkUnitId,
        completed_requirement_ids: implementationResult.completedRequirementIds,
        blocked_requirement_ids: implementationResult.blockedRequirementIds,
      }
      : initialRunState.implementation,
  };

  const deliveryAttempt = blockedReasons.length === 0 && deliveryMode === "real-pr"
    ? await attemptDelivery({
      workspace: repository.localWorkspace,
      originUrl: repository.originUrl,
      featureBranch: branch,
      targetBranch,
      runState: draftRunState,
    })
    : {
      blockedReasons: [],
      remotePushed: false,
      pullRequest: undefined,
    };

  const allBlockedReasons = dedupeReasons([...blockedReasons, ...deliveryAttempt.blockedReasons]);

  const finalRunState: RunState = {
    ...draftRunState,
    status: allBlockedReasons.length > 0 ? "blocked" : "completed",
    updated_at: new Date().toISOString(),
    current_task: allBlockedReasons.length > 0 ? "deliver" : "summarize-outcome",
    blocked_reasons: allBlockedReasons,
    delivery: {
      mode: deliveryMode,
      status: allBlockedReasons.length > 0 ? "blocked" : "completed",
      target_branch: targetBranch,
      feature_branch: branch,
      pr_url: deliveryAttempt.pullRequest?.url,
      remote_pushed: deliveryAttempt.remotePushed,
    },
    completed_tasks: coreTaskResults
      .filter((result) => result.output.status === "passed")
      .map((result) => result.taskId),
  };

  const finalTaskResults = [
    ...coreTaskResults,
    {
      taskId: "deliver",
      output: await createTask("deliver").execute({
        documents,
        repository,
        capabilities,
        runId,
        featureBranch: branch,
        targetBranch,
        runState: finalRunState,
      }),
    },
    {
      taskId: "summarize-outcome",
      output: await createTask("summarize-outcome").execute({
        documents,
        repository,
        capabilities,
        runId,
        featureBranch: branch,
        targetBranch,
        runState: finalRunState,
      }),
    },
  ];

  finalRunState.completed_tasks = finalTaskResults
    .filter((result) => result.output.status === "passed")
    .map((result) => result.taskId);

  await writeRunState(repository.localWorkspace, finalRunState);
  await writeCoreTaskStates(repository.localWorkspace, runId, finalTaskResults, allBlockedReasons);
  await appendEvidence(repository.localWorkspace, {
    id: `runtime-${runId}`,
    source_type: "runtime",
    ref: `${basename(options.projectRoot)}/run-engine`,
    summary: allBlockedReasons.length > 0 ? "Nightly run finished in blocked mode." : "Nightly run completed.",
    recorded_at: new Date().toISOString(),
  });
  await writeSnapshot(repository.localWorkspace, {
    run_id: runId,
    iteration: 1,
    created_at: new Date().toISOString(),
    branch,
    workspace: repository.localWorkspace,
    ac_status: Object.fromEntries(
      documents.acceptance.acceptance_criteria.map((acceptance) => [
        acceptance.id,
        allBlockedReasons.length > 0 && acceptance.requirement_ids.some((requirementId) =>
          finalRunState.implementation?.blocked_requirement_ids.includes(requirementId),
        )
          ? "blocked"
          : "pass",
      ]),
    ),
    failing_tests: [
      ...featureValidation.issues,
      ...regressionValidation.issues,
    ],
    changed_files: implementationResult?.changedFiles ?? [],
    blockers: allBlockedReasons.map((reason) => reason.code),
    next_actions: allBlockedReasons.map((reason) => reason.requiredAction ?? "Retry after resolving the issue."),
    validation_summary: {
      traceability: traceability.passed,
      featureValidation: featureValidation.passed,
      regressionValidation: regressionValidation.passed,
    },
  });
  await writeHandoff(
    repository.localWorkspace,
    runId,
    1,
    renderHandoff(finalRunState, allBlockedReasons),
  );

  const blockedReportPath = allBlockedReasons.length > 0
    ? await writeBlockedReport(repository.localWorkspace, finalRunState, allBlockedReasons)
    : undefined;

  return {
    runState: finalRunState,
    blockedReportPath,
  };
}

function createRunId(): string {
  return new Date().toISOString().replace(/[-:.TZ]/gu, "").slice(0, 14);
}

function collectBlockedReasons(input: {
  traceability: ReturnType<typeof evaluateTraceability>;
  featureIssues: string[];
  regressionIssues: string[];
  deliveryIssues: string[];
  taskBlockedReasons: BlockedReason[];
}): BlockedReason[] {
  const reasons: BlockedReason[] = [...input.taskBlockedReasons];

  for (const issue of input.traceability.issues) {
    reasons.push({
      code: "traceability_gate_failed",
      message: issue,
      requiredAction: "Fix document traceability before running delivery.",
      evidence: ["docs/requirements.yaml", "docs/acceptance.yaml", "docs/test-plan.yaml"],
    });
  }
  for (const issue of input.featureIssues) {
    reasons.push({
      code: "feature_validation_failed",
      message: issue,
      requiredAction: "Add or configure a feature validation command.",
      evidence: ["capability detection report"],
    });
  }
  for (const issue of input.regressionIssues) {
    reasons.push({
      code: "regression_validation_failed",
      message: issue,
      requiredAction: "Add or configure a regression validation command.",
      evidence: ["capability detection report"],
    });
  }
  for (const issue of input.deliveryIssues) {
    reasons.push({
      code: "delivery_gate_failed",
      message: issue,
      requiredAction: "Resolve delivery policy or remote configuration issues before requesting real PR delivery.",
      evidence: ["docs/spec.yaml", "repository origin configuration"],
    });
  }

  return dedupeReasons(reasons);
}

function uniqueCommands(commands: string[]): string[] {
  return [...new Set(commands)];
}

function dedupeReasons(reasons: BlockedReason[]): BlockedReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = `${reason.code}:${reason.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function writeCoreTaskStates(
  workspace: string,
  runId: string,
  taskResults: Array<{ taskId: string; output: TaskExecutionOutput }>,
  blockedReasons: BlockedReason[],
): Promise<void> {
  const tasks: TaskState[] = taskResults.map((result) =>
    createTaskState(
      result.taskId,
      runId,
      result.output,
      result.output.blockedReason ?? (result.output.status === "blocked" ? blockedReasons[0] : undefined),
    ),
  );

  for (const task of tasks) {
    await writeTaskState(workspace, task);
  }
}

function createTaskState(
  taskId: string,
  runId: string,
  output: TaskExecutionOutput,
  blockedReason?: BlockedReason,
): TaskState {
  return {
    task_id: taskId,
    run_id: runId,
    status: output.status,
    attempts: 1,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    artifacts: output.artifacts,
    evidence_refs: output.evidenceRefs,
    next_actions: output.nextActions.length > 0 ? output.nextActions : (blockedReason?.requiredAction ? [blockedReason.requiredAction] : []),
    blocked_reason: blockedReason,
    llm: output.implementation?.lastAttempt
      ? {
        backend: "codex-cli",
        work_unit_id: output.implementation.lastAttempt.workUnitId,
        session_id: output.implementation.lastAttempt.sessionId,
        model: output.implementation.lastAttempt.model,
        attempt: output.implementation.lastAttempt.attempt,
      }
      : undefined,
  };
}

function renderHandoff(runState: RunState, blockedReasons: BlockedReason[]): string {
  return `# Handoff

## objective

- Prepare a resumable local-first nightly run for ${runState.repository.canonical_repo_id}

## current_state

- run_id: ${runState.run_id}
- status: ${runState.status}
- current_task: ${runState.current_task}

## changed_files

- none

## passing_tests

- traceability: ${runState.validation.traceability}
- feature_validation: ${runState.validation.feature_validation}
- regression_validation: ${runState.validation.regression_validation}

## failing_tests

${blockedReasons.map((reason) => `- ${reason.message}`).join("\n") || "- none"}

## blockers

${blockedReasons.map((reason) => `- ${reason.code}`).join("\n") || "- none"}

## next_actions

${blockedReasons.map((reason) => `- ${reason.requiredAction ?? "Investigate and retry."}`).join("\n") || "- none"}

## evidence_refs

- .omt/evidence.json
  - docs/spec.yaml
`;
}

async function runTasks(context: {
  orderedTaskIds: string[];
  documents: Awaited<ReturnType<typeof loadDocuments>>;
  repository: Awaited<ReturnType<typeof resolveRepository>>;
  capabilities: Awaited<ReturnType<typeof detectCapabilities>>;
  runId: string;
  featureBranch: string;
  targetBranch: string;
  runState: RunState;
}): Promise<Array<{ taskId: string; output: TaskExecutionOutput }>> {
  const results: Array<{ taskId: string; output: TaskExecutionOutput }> = [];
  for (const taskId of context.orderedTaskIds) {
    const task = createTask(taskId);
    const output = await task.execute({
      documents: context.documents,
      repository: context.repository,
      capabilities: context.capabilities,
      runId: context.runId,
      featureBranch: context.featureBranch,
      targetBranch: context.targetBranch,
      runState: context.runState,
    });
    results.push({ taskId, output });
    if (output.status === "blocked") {
      break;
    }
  }
  return results;
}
