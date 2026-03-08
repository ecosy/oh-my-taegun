import { evaluateTraceability } from "../validation/traceability-gate.js";
import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class InteractiveDesignTask implements ExecutableTask {
  readonly id = "interactive-design";

  async execute(context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    const traceability = evaluateTraceability(context.documents);
    return {
      status: traceability.passed ? "passed" : "blocked",
      artifacts: ["docs/requirements.yaml", "docs/acceptance.yaml", "docs/test-plan.yaml"],
      evidenceRefs: ["docs/spec.md", "docs/spec.yaml"],
      nextActions: traceability.passed
        ? ["Proceed to freeze requirements."]
        : ["Resolve traceability issues before execution."],
      blockedReason: traceability.passed
        ? undefined
        : {
            code: "interactive_design_incomplete",
            message: traceability.issues[0] ?? "Design traceability is incomplete.",
            requiredAction: "Complete requirement, acceptance, and test plan coverage.",
            evidence: traceability.issues,
          },
    };
  }
}
