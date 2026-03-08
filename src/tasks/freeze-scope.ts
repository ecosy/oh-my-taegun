import { evaluateTraceability } from "../validation/traceability-gate.js";
import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class FreezeScopeTask implements ExecutableTask {
  readonly id = "freeze-scope";

  async execute(context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    const traceability = evaluateTraceability(context.documents);
    return {
      status: traceability.passed ? "passed" : "blocked",
      artifacts: ["docs/design_summary.md"],
      evidenceRefs: ["docs/design_summary.md"],
      nextActions: traceability.passed
        ? ["Proceed to implementation."]
        : ["Fix traceability gaps before freezing scope."],
      blockedReason: traceability.passed
        ? undefined
        : {
            code: "freeze_scope_failed",
            message: "Scope freeze failed because the document set is incomplete.",
            requiredAction: "Resolve document gaps and retry freeze.",
            evidence: traceability.issues,
          },
    };
  }
}
