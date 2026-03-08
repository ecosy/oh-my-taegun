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
import { evaluateFeatureValidation } from "../validation/feature-gate.js";
import { evaluateRegressionValidation } from "../validation/regression-gate.js";
import { evaluateDeliveryGate } from "../validation/delivery-gate.js";
import { executeCommands } from "../validation/execute-commands.js";
import type { BlockedReason, RunState, TaskState } from "../shared/types.js";

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

  const featureValidationStatic = evaluateFeatureValidation(capabilities);
  const regressionValidationStatic = evaluateRegressionValidation(capabilities);
  const featureValidationExec = featureValidationStatic.passed
    ? await executeCommands(capabilities.testCommands.slice(0, 1), repository.localWorkspace)
    : { passed: false, commands: [], outputs: [], issues: featureValidationStatic.issues };
  const regressionValidationExec = regressionValidationStatic.passed
    ? await executeCommands(uniqueCommands(capabilities.testCommands), repository.localWorkspace)
    : { passed: false, commands: [], outputs: [], issues: regressionValidationStatic.issues };
  const featureValidation = {
    passed: featureValidationStatic.passed && featureValidationExec.passed,
    issues: [...featureValidationStatic.issues, ...featureValidationExec.issues],
  };
  const regressionValidation = {
    passed: regressionValidationStatic.passed && regressionValidationExec.passed,
    issues: [...regressionValidationStatic.issues, ...regressionValidationExec.issues],
  };
  const deliveryGate = evaluateDeliveryGate({
    deliveryMode,
    originUrl: repository.originUrl,
    targetBranch,
    featureValidationPassed: featureValidation.passed,
    regressionValidationPassed: regressionValidation.passed,
    capabilities,
  });

  const blockedReasons = collectBlockedReasons({
    traceability,
    featureIssues: featureValidation.issues,
    regressionIssues: regressionValidation.issues,
    deliveryIssues: deliveryGate.issues,
  });

  const deliveryAttempt = blockedReasons.length === 0 && deliveryMode === "real-pr"
    ? await attemptDelivery({
      workspace: repository.localWorkspace,
      originUrl: repository.originUrl,
      featureBranch: branch,
      targetBranch,
      runState: {
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
        current_task: "deliver",
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
          feature_validation: featureValidation.passed,
          regression_validation: regressionValidation.passed,
        },
      },
    })
    : {
      blockedReasons: [],
      remotePushed: false,
      pullRequest: undefined,
    };

  const allBlockedReasons = dedupeReasons([...blockedReasons, ...deliveryAttempt.blockedReasons]);

  const runState: RunState = {
    run_id: runId,
    profile_id: documents.profile.profile_id,
    status: allBlockedReasons.length > 0 ? "blocked" : "completed",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    repository: {
      canonical_repo_id: repository.canonicalRepoId,
      local_workspace: repository.localWorkspace,
      default_branch: repository.defaultBranch,
    },
    current_task: allBlockedReasons.length > 0 ? "deliver" : "summarize-outcome",
    completed_tasks: allBlockedReasons.length > 0
      ? ["repo-intake", "capability-discovery", "freeze-scope", "run-validation"]
      : ["repo-intake", "capability-discovery", "freeze-scope", "run-validation", "deliver"],
    blocked_reasons: allBlockedReasons,
    delivery: {
      mode: deliveryMode,
      status: allBlockedReasons.length > 0 ? "blocked" : "completed",
      target_branch: targetBranch,
      feature_branch: branch,
      pr_url: deliveryAttempt.pullRequest?.url,
      remote_pushed: deliveryAttempt.remotePushed,
    },
    validation: {
      traceability: traceability.passed,
      feature_validation: featureValidation.passed,
      regression_validation: regressionValidation.passed,
    },
  };

  const taskResults = await runTasks({
    documents,
    repository,
    capabilities,
    runId,
    featureBranch: branch,
    targetBranch,
    runState,
  });

  await writeRunState(repository.localWorkspace, runState);
  await writeCoreTaskStates(repository.localWorkspace, runId, taskResults, allBlockedReasons);
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
        allBlockedReasons.length > 0 ? "blocked" : "pass",
      ]),
    ),
    failing_tests: [
      ...featureValidation.issues,
      ...regressionValidation.issues,
    ],
    changed_files: [],
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
    renderHandoff(runState, allBlockedReasons),
  );

  const blockedReportPath = allBlockedReasons.length > 0
    ? await writeBlockedReport(repository.localWorkspace, runState, allBlockedReasons)
    : undefined;

  return {
    runState,
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
}): BlockedReason[] {
  const reasons: BlockedReason[] = [];

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
  taskResults: Array<{ taskId: string; status: TaskState["status"]; blockedReason?: BlockedReason }>,
  blockedReasons: BlockedReason[],
): Promise<void> {
  const tasks: TaskState[] = taskResults.map((result) =>
    createTaskState(
      result.taskId,
      runId,
      result.status,
      result.blockedReason ?? (result.status === "blocked" ? blockedReasons[0] : undefined),
    ),
  );

  for (const task of tasks) {
    await writeTaskState(workspace, task);
  }
}

function createTaskState(
  taskId: string,
  runId: string,
  status: TaskState["status"],
  blockedReason?: BlockedReason,
): TaskState {
  return {
    task_id: taskId,
    run_id: runId,
    status,
    attempts: 1,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    artifacts: [],
    evidence_refs: [],
    next_actions: blockedReason?.requiredAction ? [blockedReason.requiredAction] : [],
    blocked_reason: blockedReason,
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
  documents: Awaited<ReturnType<typeof loadDocuments>>;
  repository: Awaited<ReturnType<typeof resolveRepository>>;
  capabilities: Awaited<ReturnType<typeof detectCapabilities>>;
  runId: string;
  featureBranch: string;
  targetBranch: string;
  runState: RunState;
}): Promise<Array<{ taskId: string; status: TaskState["status"]; blockedReason?: BlockedReason }>> {
  const orderedTaskIds = [
    "repo-intake",
    "capability-discovery",
    "interactive-design",
    "freeze-scope",
    "implement-changes",
    "run-validation",
    "deliver",
    "summarize-outcome",
  ];

  const results: Array<{ taskId: string; status: TaskState["status"]; blockedReason?: BlockedReason }> = [];
  for (const taskId of orderedTaskIds) {
    const task = createTask(taskId);
    const result = await task.execute({
      documents: context.documents,
      repository: context.repository,
      capabilities: context.capabilities,
      runId: context.runId,
      featureBranch: context.featureBranch,
      targetBranch: context.targetBranch,
      runState: context.runState,
    });
    results.push({
      taskId,
      status: result.status,
      blockedReason: result.blockedReason,
    });
  }
  return results;
}
