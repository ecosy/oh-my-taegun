import { CapabilityDiscoveryTask } from "../tasks/capability-discovery.js";
import { DeliverPrTask } from "../tasks/deliver-pr.js";
import { FreezeScopeTask } from "../tasks/freeze-scope.js";
import { ImplementChangesTask } from "../tasks/implement-changes.js";
import { InteractiveDesignTask } from "../tasks/interactive-design.js";
import { RepoIntakeTask } from "../tasks/repo-intake.js";
import { RunValidationTask } from "../tasks/run-validation.js";
import { SummarizeOutcomeTask } from "../tasks/summarize-outcome.js";
import type { ExecutableTask } from "../tasks/types.js";

const TASKS: Record<string, () => ExecutableTask> = {
  "repo-intake": () => new RepoIntakeTask(),
  "capability-discovery": () => new CapabilityDiscoveryTask(),
  "interactive-design": () => new InteractiveDesignTask(),
  "freeze-scope": () => new FreezeScopeTask(),
  "freeze-scope-and-requirements": () => new FreezeScopeTask(),
  "implement-changes": () => new ImplementChangesTask(),
  "run-validation": () => new RunValidationTask(),
  "deliver": () => new DeliverPrTask(),
  "summarize-outcome": () => new SummarizeOutcomeTask(),
};

export function createTask(taskId: string): ExecutableTask {
  const factory = TASKS[taskId];
  if (!factory) {
    throw new Error(`Unknown task id: ${taskId}`);
  }
  return factory();
}
