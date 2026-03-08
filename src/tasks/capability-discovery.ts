import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class CapabilityDiscoveryTask implements ExecutableTask {
  readonly id = "capability-discovery";

  async execute(context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    return {
      status: context.capabilities.classification === "blocked" ? "blocked" : "passed",
      artifacts: [],
      evidenceRefs: ["capability detection report"],
      nextActions: context.capabilities.classification === "blocked"
        ? ["Resolve capability blockers before continuing."]
        : ["Proceed to design freeze."],
      blockedReason: context.capabilities.classification === "blocked"
        ? {
            code: "capability_detection_blocked",
            message: "Repository capability detection was blocked.",
            requiredAction: "Inspect the repository stack and provide a supported runtime/toolchain.",
            evidence: context.capabilities.notes,
          }
        : undefined,
      capabilities: context.capabilities,
    };
  }
}
