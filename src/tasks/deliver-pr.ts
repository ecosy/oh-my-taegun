import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class DeliverPrTask implements ExecutableTask {
  readonly id = "deliver";

  async execute(context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    if (!context.runState) {
      return {
        status: "blocked",
        artifacts: [],
        evidenceRefs: [],
        nextActions: ["Initialize run state before delivery."],
        blockedReason: {
          code: "delivery_missing_run_state",
          message: "Run state was not prepared before delivery.",
          requiredAction: "Construct run state before invoking delivery.",
        },
      };
    }

    const deliveryBlockedReasons = context.runState.blocked_reasons.filter((reason) =>
      reason.code.startsWith("delivery_"),
    );
    const blockedReason = deliveryBlockedReasons[0];
    const prUrl = context.runState.delivery.pr_url;

    return {
      status: context.runState.delivery.status === "completed" ? "passed" : "blocked",
      artifacts: prUrl ? [prUrl] : [],
      evidenceRefs: deliveryBlockedReasons.flatMap((reason) => reason.evidence ?? []),
      nextActions: deliveryBlockedReasons.length === 0
        ? ["Generate morning summary."]
        : deliveryBlockedReasons.map((reason) => reason.requiredAction ?? "Resolve delivery issue."),
      blockedReason,
      delivery: {
        blockedReasons: deliveryBlockedReasons,
        remotePushed: context.runState.delivery.remote_pushed ?? false,
        prUrl,
      },
    };
  }
}
