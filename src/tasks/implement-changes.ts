import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class ImplementChangesTask implements ExecutableTask {
  readonly id = "implement-changes";

  async execute(_context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    // v0.1 keeps implementation changes outside the harness itself; this task reserves the slot
    // and makes the no-op explicit instead of pretending the code was changed.
    return {
      status: "passed",
      artifacts: [],
      evidenceRefs: ["local-first runtime placeholder"],
      nextActions: ["Run validation against the current workspace state."],
    };
  }
}
