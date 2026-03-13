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
      },
    };
  }

  await writeV2RunState(repository.localWorkspace, runState);
  const reportPath = await writeV2Report(repository.localWorkspace, runState);
  await writeV2Handoff(
    repository.localWorkspace,
    runId,
    `# Handoff\n\n- run_id: ${runId}\n- status: ${runState.status}\n- phase: ${runState.phase}\n- report: ${basename(reportPath)}\n`,
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

async function readDesignPackage(workspace: string): Promise<DesignPackage> {
  return JSON.parse(await readFile(v2SeedPath(workspace), "utf8")) as DesignPackage;
}

function createRunId(): string {
  return new Date().toISOString().replace(/[-:.TZ]/gu, "");
}
