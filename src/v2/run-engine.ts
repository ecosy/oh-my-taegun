import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { loadDocuments } from "../config/load-documents.js";
import { currentBranch, ensureFeatureBranch } from "../delivery/git-client.js";
import { resolveRepository } from "../intake/resolve-repo.js";
import { CodexCliAdapter } from "../llm/codex-cli-adapter.js";
import { executePlannedWorkUnits } from "../orchestrator/loop-controller.js";
import { planRequirementSteps } from "../planning/requirement-step-planner.js";
import { executeCommands } from "../validation/execute-commands.js";
import { appendEvent } from "./event-store.js";
import { v2SeedPath } from "./files.js";
import { toCapabilityReport } from "./inspect.js";
import { buildConvergenceSnapshot } from "./ontology.js";
import { detectPathologySignals } from "./pathology.js";
import { writeV2Report } from "./report.js";
import { prepareV2Resume, writeV2Handoff } from "./recovery.js";
import { buildReviewerDecision } from "./reviewer.js";
import { writeV2Snapshot } from "./snapshot-store.js";
import { writeV2RunState } from "./state-store.js";
import { resolveFeatureBranch, runDeliveryStages } from "./stage-runner.js";
import { buildVerifierDecisions } from "./verifier.js";
import type { DesignPackage, V2RunOutcome, V2RunState } from "./types.js";

export interface V2RunOptions {
  projectRoot: string;
  profilePath: string;
  gitUrl?: string;
  repoPath?: string;
}

export async function runV2Nightly(options: V2RunOptions): Promise<V2RunOutcome> {
  const documents = await loadDocuments(options.projectRoot, options.profilePath);
  const repository = await resolveRepository({
    gitUrl: options.gitUrl,
    repoPath: options.repoPath,
    workingRoot: options.projectRoot,
  });
  const designPackage = await readDesignPackage(repository.localWorkspace);
  const runId = createRunId();
  const featureBranch = resolveFeatureBranch(designPackage.deliveryPolicy.realPr.featureBranchTemplate, runId);
  await ensureFeatureBranch(repository.localWorkspace, featureBranch).catch(() => undefined);
  const activeBranch = await currentBranch(repository.localWorkspace).catch(() => featureBranch);
  const capabilities = toCapabilityReport(designPackage.verifiedCapabilityReport);
  const plan = planRequirementSteps(documents, {
    runId,
    repoRoot: repository.localWorkspace,
    capabilities,
    budget: designPackage.executionModelPolicy.workUnitBudget,
    model: designPackage.executionModelPolicy.defaultExecutionModel,
  });
  const adapter = new CodexCliAdapter(documents);

  await appendEvent(repository.localWorkspace, runId, {
    phase: "design",
    type: "model_policy_confirmed",
    payload: {
      executionModelPolicy: designPackage.executionModelPolicy,
      deliveryPolicy: designPackage.deliveryPolicy,
    },
  });

  for (const workUnit of plan.workUnits) {
    await appendEvent(repository.localWorkspace, runId, {
      phase: "plan",
      type: "work_unit_planned",
      payload: {
        workUnitId: workUnit.id,
        requirementIds: workUnit.requirementIds,
        acceptanceIds: workUnit.acceptanceIds,
      },
    });
  }

  const initialValidation = {
    passed: false,
    commands: [],
    outputs: [],
    issues: ["Validation did not run."],
  };
  let runState: V2RunState = {
    runId,
    profileVersion: 2,
    repository,
    status: "running",
    phase: "execute",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionModelPolicy: designPackage.executionModelPolicy,
    deliveryPolicy: designPackage.deliveryPolicy,
    ambiguityScorecard: designPackage.ambiguityScorecard,
    pathologySignals: [],
    blockedReasons: [],
    verifierDecisions: [],
    validationSummary: {
      featureValidation: initialValidation,
      regressionValidation: initialValidation,
    },
    deliveryStatus: {
      mode: designPackage.deliveryPolicy.targetStage,
      status: "pending",
      featureBranch: activeBranch,
      targetBranch: designPackage.deliveryPolicy.realPr.targetBranch,
      targetStage: designPackage.deliveryPolicy.targetStage,
      currentStage: "dry-run",
      completedStages: [],
      stageResults: [],
      deliveryReadiness: "blocked-on-policy",
      blockingChecks: [],
      nextActions: ["Finish design confirmation before delivery readiness can be evaluated."],
    },
  };

  if (plan.blockedReasons?.length) {
    runState = {
      ...runState,
      status: "blocked",
      phase: "plan",
      blockedReasons: plan.blockedReasons.map((message) => ({
        code: "oversized_work_unit",
        message,
      })),
    };
  } else {
    const attemptTelemetry: Array<{ summary: string; hasNewEvidence: boolean }> = [];
    const loopResult = await executePlannedWorkUnits({
      documents,
      repository,
      runId,
      executor: adapter,
      workUnits: plan.workUnits,
      snapshotWriter: async (payload) => {
        await writeV2Snapshot(repository.localWorkspace, {
          runId: payload.runId,
          iteration: payload.iteration,
          createdAt: new Date().toISOString(),
          phase: "execute",
          changedFiles: payload.changedFiles,
          failingTests: payload.failingTests,
          nextActions: payload.nextActions,
          executionModelPolicy: designPackage.executionModelPolicy,
        });
        await appendEvent(repository.localWorkspace, runId, {
          phase: "execute",
          type: "snapshot_written",
          payload: {
            iteration: payload.iteration,
          },
        });
      },
      eventSink: async (event) => {
        if (event.type === "work_unit_completed" && event.summary) {
          attemptTelemetry.push({
            summary: event.summary,
            hasNewEvidence: event.hasNewEvidence ?? false,
          });
        }
        await appendEvent(repository.localWorkspace, runId, {
          phase: "execute",
          type: event.type,
          payload: event,
        });
      },
    });

    const featureValidation = capabilities.testCommands.length > 0
      ? await executeCommands(capabilities.testCommands.slice(0, 1), repository.localWorkspace)
      : {
          passed: false,
          commands: [],
          outputs: [],
          issues: ["No verified test command available."],
        };
    const regressionValidation = capabilities.testCommands.length > 0
      ? await executeCommands([...new Set(capabilities.testCommands)], repository.localWorkspace)
      : {
          passed: false,
          commands: [],
          outputs: [],
          issues: ["No verified regression commands available."],
        };
    await appendEvent(repository.localWorkspace, runId, {
      phase: "verify",
      type: "validation_completed",
      payload: {
        featurePassed: featureValidation.passed,
        regressionPassed: regressionValidation.passed,
      },
    });

    const convergenceSnapshot = buildConvergenceSnapshot({
      designSeed: designPackage.ontologySeed,
      targetRequirementIds: [...new Set(plan.workUnits.flatMap((unit) => unit.requirementIds))],
      targetAcceptanceIds: [...new Set(plan.workUnits.flatMap((unit) => unit.acceptanceIds))],
      completedRequirementIds: loopResult.completedRequirementIds,
      coveredAcceptanceIds: featureValidation.passed && regressionValidation.passed
        ? [...new Set(plan.workUnits.flatMap((unit) => unit.acceptanceIds))]
        : [],
      executionModelPolicy: designPackage.executionModelPolicy,
      changedFiles: loopResult.changedFiles,
      blockedReasons: loopResult.blockedReason ? [loopResult.blockedReason] : [],
      threshold: 0.95,
    });
    const verifierDecisions = buildVerifierDecisions({
      convergenceSnapshot,
      featureValidation,
      regressionValidation,
      executionModelPolicy: designPackage.executionModelPolicy,
      verifiedCapabilityReport: designPackage.verifiedCapabilityReport,
    });
    for (const decision of verifierDecisions) {
      await appendEvent(repository.localWorkspace, runId, {
        phase: "verify",
        type: "verifier_decision_recorded",
        payload: decision as unknown as Record<string, unknown>,
      });
    }

    const blockedReasons = [
      ...(loopResult.blockedReason ? [loopResult.blockedReason] : []),
      ...verifierDecisions
        .filter((decision) => !decision.passed)
        .map((decision) => ({
          code: decision.id,
          message: decision.reasons[0] ?? decision.id,
          evidence: decision.reasons,
        })),
    ];
    const pathologySignals = detectPathologySignals(attemptTelemetry);
    const reviewerDecision = designPackage.deliveryPolicy.reviewRequired
      ? buildReviewerDecision({
          changedFiles: loopResult.changedFiles,
          featureValidation,
          regressionValidation,
          verifierDecisions,
        })
      : undefined;

    if (reviewerDecision) {
      await appendEvent(repository.localWorkspace, runId, {
        phase: "review",
        type: "review_completed",
        payload: reviewerDecision as unknown as Record<string, unknown>,
      });
    }

    runState = {
      ...runState,
      phase: blockedReasons.length > 0 ? "verify" : (reviewerDecision ? "review" : "deliver"),
      updatedAt: new Date().toISOString(),
      convergenceSnapshot,
      pathologySignals,
      blockedReasons,
      verifierDecisions,
      reviewerDecision,
      validationSummary: {
        featureValidation,
        regressionValidation,
      },
    };

    const deliveryOutcome = blockedReasons.length > 0
      ? undefined
      : await runDeliveryStages({
          workspace: repository.localWorkspace,
          runId,
          originUrl: repository.originUrl,
          featureBranch,
          deliveryStatus: runState.deliveryStatus,
          deliveryPolicy: designPackage.deliveryPolicy,
          reviewerDecision,
        });
    const deliveryBlockedReasons = deliveryOutcome?.blockedReasons ?? [];
    const deliveryStatus = deliveryOutcome?.deliveryStatus ?? runState.deliveryStatus;

    const combinedBlockedReasons = [...blockedReasons, ...deliveryBlockedReasons];
    if (combinedBlockedReasons.length > 0) {
      for (const reason of combinedBlockedReasons) {
        await appendEvent(repository.localWorkspace, runId, {
          phase: deliveryBlockedReasons.length > 0 ? "deliver" : runState.phase,
          type: "blocked_raised",
          payload: {
            message: reason.message,
          },
        });
      }
    }

    const deliveryAssessment = assessDeliveryReadiness({
      targetStage: designPackage.deliveryPolicy.targetStage,
      featureValidationPassed: featureValidation.passed,
      regressionValidationPassed: regressionValidation.passed,
      hasVerifiedTests: capabilities.testCommands.length > 0,
      policyOpenQuestions: [
        ...designPackage.executionModelPolicy.openQuestions,
        ...designPackage.deliveryPolicy.openQuestions,
      ],
      verifierDecisions,
      reviewerDecision,
      blockedReasons: combinedBlockedReasons,
      deliveryStatus,
    });

    runState = {
      ...runState,
      status: combinedBlockedReasons.length > 0 ? "blocked" : "completed",
      phase: combinedBlockedReasons.length > 0
        ? (deliveryBlockedReasons.length > 0 ? "deliver" : runState.phase)
        : "deliver",
      updatedAt: new Date().toISOString(),
      blockedReasons: combinedBlockedReasons,
      deliveryStatus: {
        ...deliveryStatus,
        status: combinedBlockedReasons.length > 0 ? "blocked" : "completed",
        deliveryReadiness: deliveryAssessment.deliveryReadiness,
        blockingChecks: deliveryAssessment.blockingChecks,
        nextActions: deliveryAssessment.nextActions,
      },
    };
  }

  await writeV2RunState(repository.localWorkspace, runState);
  const reportPath = await writeV2Report(repository.localWorkspace, runState);
  await writeV2Handoff(repository.localWorkspace, runId, renderHandoff(runState, reportPath));
  await appendEvent(repository.localWorkspace, runId, {
    phase: runState.phase,
    type: "delivery_completed",
    payload: {
      status: runState.deliveryStatus.status,
      reportPath,
    },
  });

  return {
    runState,
    reportPath,
  };
}

function assessDeliveryReadiness(input: {
  targetStage: V2RunState["deliveryPolicy"]["targetStage"];
  featureValidationPassed: boolean;
  regressionValidationPassed: boolean;
  hasVerifiedTests: boolean;
  policyOpenQuestions: string[];
  verifierDecisions: V2RunState["verifierDecisions"];
  reviewerDecision?: V2RunState["reviewerDecision"];
  blockedReasons: V2RunState["blockedReasons"];
  deliveryStatus: V2RunState["deliveryStatus"];
}): Pick<V2RunState["deliveryStatus"], "deliveryReadiness" | "blockingChecks" | "nextActions"> {
  const blockingChecks = [
    {
      code: "policy_confirmed",
      passed: input.policyOpenQuestions.length === 0,
      message: input.policyOpenQuestions.length === 0
        ? "Execution and delivery policies are confirmed."
        : "Execution or delivery policy still has open questions.",
    },
    {
      code: "verified_tests_available",
      passed: input.hasVerifiedTests,
      message: input.hasVerifiedTests
        ? "At least one verified test command is available."
        : "No verified test command is available.",
    },
    {
      code: "feature_validation_passed",
      passed: input.featureValidationPassed,
      message: input.featureValidationPassed ? "Feature validation passed." : "Feature validation failed.",
    },
    {
      code: "regression_validation_passed",
      passed: input.regressionValidationPassed,
      message: input.regressionValidationPassed ? "Regression validation passed." : "Regression validation failed.",
    },
    {
      code: "verifier_passed",
      passed: input.verifierDecisions.some((decision) => decision.id === "verifier_pass" && decision.passed),
      message: input.verifierDecisions.some((decision) => decision.id === "verifier_pass" && decision.passed)
        ? "Verifier accepted the run."
        : "Verifier did not accept the run.",
    },
    {
      code: "reviewer_passed",
      passed: input.reviewerDecision ? input.reviewerDecision.status === "pass" : true,
      message: input.reviewerDecision
        ? (input.reviewerDecision.status === "pass" ? "Reviewer accepted promotion." : "Reviewer did not accept promotion.")
        : "Reviewer gate not required for this target stage.",
    },
  ];

  const blockedCodes = new Set(input.blockedReasons.map((reason) => reason.code));
  const deliveryReadiness = input.policyOpenQuestions.length > 0 || input.verifierDecisions.some((decision) => decision.id === "verifier_replan")
    ? "blocked-on-policy"
    : input.reviewerDecision && input.reviewerDecision.status !== "pass"
      ? "blocked-on-review"
      : !input.hasVerifiedTests
        ? "blocked-on-capability"
        : blockedCodes.has("verifier_block")
          ? "blocked-on-validation"
          : !input.featureValidationPassed || !input.regressionValidationPassed
            ? "blocked-on-validation"
            : input.targetStage === "dry-run"
              ? "dry-run-ready"
              : input.deliveryStatus.status === "completed"
                ? "stage-complete"
                : "blocked-on-policy";

  const nextActions = deliveryReadiness === "dry-run-ready"
    ? [
        "Review the V2 report and validation outputs.",
        "Decide whether to promote this dry-run result into a commit, PR, or deploy stage.",
      ]
    : deliveryReadiness === "stage-complete"
      ? [
          "Review the completed stage timeline in the V2 report.",
          "Validate any external system effects before starting a new V2 run.",
        ]
      : deliveryReadiness === "blocked-on-capability"
        ? [
            "Add or verify the missing capability inputs before rerunning.",
            "Rerun design with updated delivery mappings if deploy stages are required.",
          ]
        : deliveryReadiness === "blocked-on-review"
          ? input.reviewerDecision?.nextActions ?? ["Resolve reviewer findings before promotion."]
          : deliveryReadiness === "blocked-on-validation"
            ? [
                "Inspect the failing validation or delivery stage outputs in the report.",
                "Fix validation failures or narrow the work-unit scope before rerunning.",
              ]
            : [
                "Resolve execution or delivery policy questions before rerunning.",
                "If ontology drift was detected, replan the design package before continuing.",
              ];

  return {
    deliveryReadiness,
    blockingChecks,
    nextActions,
  };
}

function renderHandoff(runState: V2RunState, reportPath: string): string {
  return [
    "# Handoff",
    "",
    `- run_id: ${runState.runId}`,
    `- status: ${runState.status}`,
    `- phase: ${runState.phase}`,
    `- report: ${basename(reportPath)}`,
    `- target_stage: ${runState.deliveryPolicy.targetStage}`,
    `- current_stage: ${runState.deliveryStatus.currentStage}`,
    `- delivery_readiness: ${runState.deliveryStatus.deliveryReadiness}`,
    `- reviewer_status: ${runState.reviewerDecision?.status ?? "not-required"}`,
    "",
    "## Completed Stages",
    ...(runState.deliveryStatus.completedStages.length > 0
      ? runState.deliveryStatus.completedStages.map((stage) => `- ${stage}`)
      : ["- none"]),
    "",
    "## Stage Results",
    ...runState.deliveryStatus.stageResults.map((result) =>
      `- ${result.stage}: ${result.status}${result.command ? ` (${result.command})` : ""}`),
    "",
    "## Blocking Checks",
    ...runState.deliveryStatus.blockingChecks.map((check) => `- ${check.code}: ${check.passed ? "passed" : "failed"} (${check.message})`),
    "",
    "## Next Actions",
    ...runState.deliveryStatus.nextActions.map((action) => `- ${action}`),
    "",
    "## Blocked Reasons",
    ...(runState.blockedReasons.length > 0
      ? runState.blockedReasons.map((reason) => `- ${reason.code}: ${reason.message}`)
      : ["- none"]),
    "",
  ].join("\n");
}

async function readDesignPackage(workspace: string): Promise<DesignPackage> {
  return JSON.parse(await readFile(v2SeedPath(workspace), "utf8")) as DesignPackage;
}

function createRunId(): string {
  return new Date().toISOString().replace(/[-:.TZ]/gu, "");
}

export async function prepareV2RunResume(workspace: string, runId: string) {
  return prepareV2Resume(workspace, runId);
}
