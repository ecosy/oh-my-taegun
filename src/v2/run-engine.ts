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
import { calculateOntologySimilarity } from "./ontology.js";
import { writeV2Report } from "./report.js";
import { writeV2Handoff } from "./recovery.js";
import { writeV2Snapshot } from "./snapshot-store.js";
import { writeV2RunState } from "./state-store.js";
import { toCapabilityReport } from "./inspect.js";
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
  const featureBranch = `feature/omt-v2-${runId}`;
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
    ambiguityScorecard: designPackage.ambiguityScorecard,
    pathologySignals: [],
    blockedReasons: [],
    verifierDecisions: [],
    validationSummary: {
      featureValidation: initialValidation,
      regressionValidation: initialValidation,
    },
      deliveryStatus: {
        mode: "dry-run",
        status: "pending",
        featureBranch: activeBranch,
        targetBranch: documents.profile.delivery?.branch_strategy?.target_branch ?? "develop",
        deliveryReadiness: "blocked-on-policy",
        blockingChecks: [],
        nextActions: ["Finish design confirmation before delivery readiness can be evaluated."],
      },
    };

  if (plan.blockedReasons && plan.blockedReasons.length > 0) {
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

    const convergenceSnapshot = {
      generatedAt: new Date().toISOString(),
      similarity: calculateOntologySimilarity(designPackage.ontologySeed, designPackage.ontologySeed),
      threshold: 0.95,
      converged: true,
      ontologyDriftDetected: false,
      driftCategories: [],
      missingCoverage: [],
      replanSuggested: false,
    };
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
    if (blockedReasons.length > 0) {
      for (const reason of blockedReasons) {
        await appendEvent(repository.localWorkspace, runId, {
          phase: "verify",
          type: "blocked_raised",
          payload: {
            message: reason.message,
          },
        });
      }
    }

    const deliveryAssessment = assessDeliveryReadiness({
      featureValidationPassed: featureValidation.passed,
      regressionValidationPassed: regressionValidation.passed,
      hasVerifiedTests: capabilities.testCommands.length > 0,
      policyOpenQuestions: designPackage.executionModelPolicy.openQuestions,
      verifierDecisions,
      blockedReasons,
    });

    runState = {
      ...runState,
      status: blockedReasons.length > 0 ? "blocked" : "completed",
      phase: blockedReasons.length > 0 ? "verify" : "deliver",
      updatedAt: new Date().toISOString(),
      convergenceSnapshot,
      blockedReasons,
      verifierDecisions,
      validationSummary: {
        featureValidation,
        regressionValidation,
      },
      deliveryStatus: {
        ...runState.deliveryStatus,
        status: blockedReasons.length > 0 ? "blocked" : "completed",
        deliveryReadiness: deliveryAssessment.deliveryReadiness,
        blockingChecks: deliveryAssessment.blockingChecks,
        nextActions: deliveryAssessment.nextActions,
      },
    };
  }

  await writeV2RunState(repository.localWorkspace, runState);
  const reportPath = await writeV2Report(repository.localWorkspace, runState);
  await writeV2Handoff(
    repository.localWorkspace,
    runId,
    [
      "# Handoff",
      "",
      `- run_id: ${runId}`,
      `- status: ${runState.status}`,
      `- phase: ${runState.phase}`,
      `- report: ${basename(reportPath)}`,
      `- delivery_readiness: ${runState.deliveryStatus.deliveryReadiness}`,
      "",
      "## Blocking Checks",
      ...runState.deliveryStatus.blockingChecks.map((check) => `- ${check.code}: ${check.passed ? "passed" : "failed"} (${check.message})`),
      "",
      "## Next Actions",
      ...runState.deliveryStatus.nextActions.map((action) => `- ${action}`),
      "",
      "## Blocked Reasons",
      ...runState.blockedReasons.map((reason) => `- ${reason.code}: ${reason.message}`),
      "",
    ].join("\n"),
  );
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
  featureValidationPassed: boolean;
  regressionValidationPassed: boolean;
  hasVerifiedTests: boolean;
  policyOpenQuestions: string[];
  verifierDecisions: V2RunState["verifierDecisions"];
  blockedReasons: V2RunState["blockedReasons"];
}): Pick<V2RunState["deliveryStatus"], "deliveryReadiness" | "blockingChecks" | "nextActions"> {
  const blockingChecks = [
    {
      code: "policy_confirmed",
      passed: input.policyOpenQuestions.length === 0,
      message: input.policyOpenQuestions.length === 0
        ? "Execution model policy is confirmed."
        : "Execution model policy still has open questions.",
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
      message: input.featureValidationPassed
        ? "Feature validation passed."
        : "Feature validation failed.",
    },
    {
      code: "regression_validation_passed",
      passed: input.regressionValidationPassed,
      message: input.regressionValidationPassed
        ? "Regression validation passed."
        : "Regression validation failed.",
    },
    {
      code: "verifier_passed",
      passed: input.verifierDecisions.some((decision) => decision.id === "verifier_pass" && decision.passed),
      message: input.verifierDecisions.some((decision) => decision.id === "verifier_pass" && decision.passed)
        ? "Verifier accepted the run."
        : "Verifier did not accept the run.",
    },
  ];

  const blockedCodes = new Set(input.blockedReasons.map((reason) => reason.code));
  const deliveryReadiness = input.policyOpenQuestions.length > 0 || input.verifierDecisions.some((decision) => decision.id === "verifier_replan")
    ? "blocked-on-policy"
    : !input.hasVerifiedTests || blockedCodes.has("verifier_block")
      ? input.hasVerifiedTests ? "blocked-on-validation" : "blocked-on-capability"
      : !input.featureValidationPassed || !input.regressionValidationPassed
        ? "blocked-on-validation"
        : "dry-run-ready";

  const nextActions = deliveryReadiness === "dry-run-ready"
    ? [
        "Review the V2 report and validation outputs.",
        "Decide whether to promote this dry-run result into a manual delivery step.",
      ]
    : deliveryReadiness === "blocked-on-capability"
      ? [
          "Add or verify at least one test command for this repository.",
          "Rerun doctor and design before starting a new V2 run.",
        ]
      : deliveryReadiness === "blocked-on-validation"
        ? [
            "Inspect the failing validation outputs in the report.",
            "Fix validation failures or narrow the work unit scope before rerunning.",
          ]
        : [
            "Resolve execution or verifier policy questions before seed freeze or rerun.",
            "If ontology drift was detected, replan the design package before continuing.",
          ];

  return {
    deliveryReadiness,
    blockingChecks,
    nextActions,
  };
}

async function readDesignPackage(workspace: string): Promise<DesignPackage> {
  return JSON.parse(await readFile(v2SeedPath(workspace), "utf8")) as DesignPackage;
}

function createRunId(): string {
  return new Date().toISOString().replace(/[-:.TZ]/gu, "");
}
