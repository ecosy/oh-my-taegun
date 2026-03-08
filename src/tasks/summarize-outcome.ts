import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class SummarizeOutcomeTask implements ExecutableTask {
  readonly id = "summarize-outcome";

  async execute(context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    const prUrl = context.runState?.delivery.pr_url;
    const nextActions = prUrl ? ["Review the generated PR."] : ["Inspect blocked report or runtime artifacts."];

    return {
      status: "passed",
      artifacts: prUrl ? [prUrl] : [],
      evidenceRefs: ["docs/design_summary.md", ".omt/state/run.json"],
      nextActions,
    };
  }
}
