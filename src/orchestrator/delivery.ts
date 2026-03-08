import { branchHasDiffFromBase, commitWorkingTree, hasOrigin, pushBranch } from "../delivery/git-client.js";
import { blockedPrReason, createOrUpdatePullRequest } from "../delivery/pr-client.js";
import type { BlockedReason, PullRequestResult, RunState } from "../shared/types.js";

export interface DeliveryAttemptInput {
  workspace: string;
  originUrl?: string;
  featureBranch: string;
  targetBranch: string;
  runState: RunState;
}

export interface DeliveryAttemptResult {
  blockedReasons: BlockedReason[];
  pullRequest?: PullRequestResult;
  remotePushed: boolean;
}

export async function attemptDelivery(input: DeliveryAttemptInput): Promise<DeliveryAttemptResult> {
  const blockedReasons: BlockedReason[] = [];
  let remotePushed = false;

  if (!input.originUrl || !(await hasOrigin(input.workspace))) {
    blockedReasons.push({
      code: "delivery_origin_missing",
      message: "Repository origin URL is not configured.",
      requiredAction: "Add an origin remote before requesting real PR delivery.",
      evidence: ["git remote get-url origin"],
    });
    return { blockedReasons, remotePushed };
  }

  let committedChanges = false;
  try {
    committedChanges = await commitWorkingTree(input.workspace, `chore(omt): nightly run ${input.runState.run_id}`);
  } catch (cause) {
    blockedReasons.push({
      code: "delivery_commit_failed",
      message: cause instanceof Error ? cause.message : "Failed to commit workspace changes before delivery.",
      requiredAction: "Resolve git commit issues in the feature branch and retry delivery.",
      evidence: ["git status --short", "git commit -m <message>"],
    });
    return { blockedReasons, remotePushed };
  }

  if (!(await branchHasDiffFromBase(input.workspace, input.targetBranch, input.featureBranch, input.originUrl))) {
    blockedReasons.push({
      code: "delivery_no_diff",
      message: committedChanges
        ? "Feature branch still has no commits ahead of the target branch after auto-commit."
        : "Feature branch has no commits ahead of the target branch.",
      requiredAction: "Create code changes or commits before requesting PR delivery.",
      evidence: [`git rev-list --left-right --count ${input.targetBranch}...${input.featureBranch}`],
    });
    return { blockedReasons, remotePushed };
  }

  try {
    await pushBranch(input.workspace, input.featureBranch, input.originUrl);
    remotePushed = true;
  } catch (cause) {
    blockedReasons.push({
      code: "delivery_push_failed",
      message: cause instanceof Error ? cause.message : "Failed to push feature branch.",
      requiredAction: "Check remote permissions and network access, then retry.",
      evidence: ["git push -u origin <feature-branch>"],
    });
    return { blockedReasons, remotePushed };
  }

  try {
    const pullRequest = await createOrUpdatePullRequest({
      originUrl: input.originUrl,
      headBranch: input.featureBranch,
      baseBranch: input.targetBranch,
      title: `oh-my-taegun: ${input.runState.run_id}`,
      body: renderPullRequestBody(input.runState),
    });
    return {
      blockedReasons,
      pullRequest,
      remotePushed,
    };
  } catch (cause) {
    blockedReasons.push({
      ...blockedPrReason(),
      message: cause instanceof Error ? cause.message : blockedPrReason().message,
    });
    return { blockedReasons, remotePushed };
  }
}

function renderPullRequestBody(runState: RunState): string {
  return [
    "## Summary",
    `- run_id: ${runState.run_id}`,
    `- feature_branch: ${runState.delivery.feature_branch}`,
    `- target_branch: ${runState.delivery.target_branch}`,
    "",
    "## Validation",
    `- traceability: ${runState.validation.traceability}`,
    `- feature_validation: ${runState.validation.feature_validation}`,
    `- regression_validation: ${runState.validation.regression_validation}`,
  ].join("\n");
}
