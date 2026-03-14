import { branchExists, branchHasDiffFromBase, commitWorkingTreeWithSha, hasOrigin, pushBranch } from "../delivery/git-client.js";
import { createOrUpdatePullRequest } from "../delivery/pr-client.js";
import { executeStageCommand } from "./command-adapter.js";
import type { BlockedReason } from "../shared/types.js";
import type { DeliveryTargetStage, ReviewerDecision, V2RunState } from "./types.js";

const STAGE_SEQUENCE: DeliveryTargetStage[] = ["dry-run", "commit", "real-pr", "dev", "prod"];

export async function runDeliveryStages(input: {
  workspace: string;
  runId: string;
  originUrl?: string;
  featureBranch: string;
  deliveryStatus: V2RunState["deliveryStatus"];
  deliveryPolicy: V2RunState["deliveryPolicy"];
  reviewerDecision?: ReviewerDecision;
}): Promise<{
  deliveryStatus: V2RunState["deliveryStatus"];
  blockedReasons: BlockedReason[];
}> {
  let deliveryStatus = {
    ...input.deliveryStatus,
    currentStage: "dry-run" as DeliveryTargetStage,
    completedStages: [...input.deliveryStatus.completedStages],
    stageResults: [...input.deliveryStatus.stageResults],
  };
  const blockedReasons: BlockedReason[] = [];

  for (const stage of stagesForTarget(input.deliveryPolicy.targetStage)) {
    deliveryStatus.currentStage = stage;
    if (stage === "dry-run") {
      deliveryStatus.stageResults.push({
        stage,
        status: "completed",
        evidenceRefs: [],
        nextActions: ["Review the V2 report before promoting beyond dry-run."],
      });
      deliveryStatus.completedStages.push(stage);
      continue;
    }

    if (stage !== "commit" && input.deliveryPolicy.reviewRequired && input.reviewerDecision?.status !== "pass") {
      const reason = {
        code: "reviewer_block",
        message: "Reviewer did not approve promotion beyond local execution.",
        requiredAction: "Resolve reviewer findings before continuing to remote or deploy stages.",
        evidence: input.reviewerDecision?.findings ?? [],
      };
      blockedReasons.push(reason);
      deliveryStatus.failedStage = stage;
      deliveryStatus.stageResults.push({
        stage,
        status: "blocked",
        evidenceRefs: input.reviewerDecision?.evidenceRefs ?? [],
        nextActions: input.reviewerDecision?.nextActions ?? [reason.requiredAction ?? "Resolve reviewer feedback."],
      });
      break;
    }

    if (stage === "commit") {
      const sha = await commitWorkingTreeWithSha(input.workspace, `chore(omt): v2 run ${input.runId}`);
      if (!sha) {
        blockedReasons.push({
          code: "delivery_commit_failed",
          message: "Commit stage requires local changes, but no commit was created.",
          requiredAction: "Ensure implementation changes exist before requesting commit or higher stages.",
        });
        deliveryStatus.failedStage = stage;
        deliveryStatus.stageResults.push({
          stage,
          status: "blocked",
          evidenceRefs: [],
          nextActions: ["Inspect the workspace diff and rerun after changes are present."],
        });
        break;
      }
      deliveryStatus.localCommitSha = sha;
      deliveryStatus.stageResults.push({
        stage,
        status: "completed",
        evidenceRefs: [sha],
        nextActions: [],
      });
      deliveryStatus.completedStages.push(stage);
      continue;
    }

    if (stage === "real-pr") {
      const realPrResult = await runRealPrStage({
        workspace: input.workspace,
        originUrl: input.originUrl,
        featureBranch: input.featureBranch,
        targetBranch: input.deliveryPolicy.realPr.targetBranch,
        titleTemplate: input.deliveryPolicy.realPr.titleTemplate.replace("{run_id}", input.runId),
        reviewerDecision: input.reviewerDecision,
        localCommitSha: deliveryStatus.localCommitSha,
      });
      deliveryStatus.stageResults.push(realPrResult.stageResult);
      if (realPrResult.blockedReason) {
        blockedReasons.push(realPrResult.blockedReason);
        deliveryStatus.failedStage = stage;
        break;
      }
      deliveryStatus.prUrl = realPrResult.prUrl;
      deliveryStatus.completedStages.push(stage);
      continue;
    }

    const commandPolicy = stage === "dev" ? input.deliveryPolicy.dev : input.deliveryPolicy.prod;
    const missingEnv = (commandPolicy?.envRefs ?? []).filter((name) => !process.env[name]);
    if (!commandPolicy?.command || !commandPolicy.validationCommand) {
      blockedReasons.push({
        code: `${stage}_command_missing`,
        message: `${stage} stage is missing an execution or validation command.`,
        requiredAction: `Provide explicit ${stage} delivery commands in the design interview.`,
      });
      deliveryStatus.failedStage = stage;
      deliveryStatus.stageResults.push({
        stage,
        status: "blocked",
        evidenceRefs: [],
        nextActions: [`Add ${stage} delivery commands to the V2 answers file or interactive interview.`],
      });
      break;
    }
    if (missingEnv.length > 0) {
      blockedReasons.push({
        code: `${stage}_env_missing`,
        message: `${stage} stage is missing required environment references: ${missingEnv.join(", ")}.`,
        requiredAction: `Populate ${missingEnv.join(", ")} before rerunning ${stage} delivery.`,
      });
      deliveryStatus.failedStage = stage;
      deliveryStatus.stageResults.push({
        stage,
        status: "blocked",
        evidenceRefs: missingEnv,
        nextActions: [`Set ${missingEnv.join(", ")} and rerun the blocked stage.`],
      });
      break;
    }

    const stageResult = await executeStageCommand({
      stage,
      runnerKind: commandPolicy.runnerKind,
      command: commandPolicy.command,
      validationCommand: commandPolicy.validationCommand,
      workspace: input.workspace,
      env: process.env,
    });
    deliveryStatus.stageResults.push(stageResult);
    if (stageResult.status !== "completed") {
      blockedReasons.push({
        code: `${stage}_execution_failed`,
        message: `${stage} stage did not complete successfully.`,
        requiredAction: `Inspect ${stage} stage outputs and retry.`,
        evidence: stageResult.evidenceRefs,
      });
      deliveryStatus.failedStage = stage;
      break;
    }
    deliveryStatus.completedStages.push(stage);
  }

  deliveryStatus.currentStage = blockedReasons.length > 0
    ? deliveryStatus.failedStage ?? deliveryStatus.currentStage
    : input.deliveryPolicy.targetStage;
  deliveryStatus.status = blockedReasons.length > 0 ? "blocked" : "completed";

  return {
    deliveryStatus,
    blockedReasons,
  };
}

export function resolveFeatureBranch(template: string, runId: string): string {
  return template.replace("{run_id}", runId);
}

function stagesForTarget(targetStage: DeliveryTargetStage): DeliveryTargetStage[] {
  const stages = STAGE_SEQUENCE.slice(0, STAGE_SEQUENCE.indexOf(targetStage) + 1);
  return stages;
}

async function runRealPrStage(input: {
  workspace: string;
  originUrl?: string;
  featureBranch: string;
  targetBranch: string;
  titleTemplate: string;
  reviewerDecision?: ReviewerDecision;
  localCommitSha?: string;
}): Promise<{
  stageResult: V2RunState["deliveryStatus"]["stageResults"][number];
  blockedReason?: BlockedReason;
  prUrl?: string;
}> {
  if (!input.originUrl || !(await hasOrigin(input.workspace))) {
    return blockedStage("real-pr", "delivery_origin_missing", "Repository origin URL is not configured.");
  }
  if (!(await branchExists(input.workspace, input.targetBranch, input.originUrl))) {
    return blockedStage("real-pr", "delivery_target_branch_missing", `Target branch '${input.targetBranch}' does not exist.`);
  }
  if (!input.localCommitSha && !(await branchHasDiffFromBase(input.workspace, input.targetBranch, input.featureBranch, input.originUrl))) {
    return blockedStage("real-pr", "delivery_no_diff", "Feature branch has no commits ahead of the target branch.");
  }

  try {
    await pushBranch(input.workspace, input.featureBranch, input.originUrl);
    const pr = await createOrUpdatePullRequest({
      originUrl: input.originUrl,
      headBranch: input.featureBranch,
      baseBranch: input.targetBranch,
      title: input.titleTemplate,
      body: renderPrBody(input.reviewerDecision),
    });
    return {
      prUrl: pr.url,
      stageResult: {
        stage: "real-pr",
        status: "completed",
        evidenceRefs: [pr.url],
        nextActions: [],
      },
    };
  } catch (cause) {
    return blockedStage(
      "real-pr",
      "delivery_push_or_pr_failed",
      cause instanceof Error ? cause.message : "Failed to push branch or create PR.",
    );
  }
}

function blockedStage(
  stage: DeliveryTargetStage,
  code: string,
  message: string,
): {
  stageResult: V2RunState["deliveryStatus"]["stageResults"][number];
  blockedReason: BlockedReason;
} {
  return {
    blockedReason: {
      code,
      message,
      requiredAction: `Resolve the ${stage} delivery issue and rerun the blocked stage.`,
    },
    stageResult: {
      stage,
      status: "blocked",
      evidenceRefs: [],
      nextActions: [`Resolve the ${stage} delivery issue and rerun.`],
    },
  };
}

function renderPrBody(reviewerDecision?: ReviewerDecision): string {
  return [
    "## Summary",
    "- Generated by OMT V2 stage-based delivery runtime.",
    "",
    "## Reviewer",
    `- status: ${reviewerDecision?.status ?? "pass"}`,
    `- summary: ${reviewerDecision?.summary ?? "No reviewer summary recorded."}`,
    "",
    "## Reviewer Findings",
    ...(reviewerDecision?.findings.length
      ? reviewerDecision.findings.map((finding) => `- ${finding}`)
      : ["- none"]),
  ].join("\n");
}
