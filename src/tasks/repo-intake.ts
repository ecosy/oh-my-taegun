import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class RepoIntakeTask implements ExecutableTask {
  readonly id = "repo-intake";

  async execute(context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    return {
      status: "passed",
      artifacts: [context.repository.localWorkspace],
      evidenceRefs: [context.repository.localWorkspace],
      nextActions: ["Proceed to capability discovery."],
      repository: context.repository,
    };
  }
}
