import { executeCommands } from "../validation/execute-commands.js";
import { evaluateFeatureValidation } from "../validation/feature-gate.js";
import { evaluateRegressionValidation } from "../validation/regression-gate.js";
import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class RunValidationTask implements ExecutableTask {
  readonly id = "run-validation";

  async execute(context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    const featureStatic = evaluateFeatureValidation(context.capabilities);
    const regressionStatic = evaluateRegressionValidation(context.capabilities);
    const featureExec = featureStatic.passed
      ? await executeCommands(context.capabilities.testCommands.slice(0, 1), context.repository.localWorkspace)
      : { passed: false, commands: [], outputs: [], issues: featureStatic.issues };
    const regressionExec = regressionStatic.passed
      ? await executeCommands([...new Set(context.capabilities.testCommands)], context.repository.localWorkspace)
      : { passed: false, commands: [], outputs: [], issues: regressionStatic.issues };

    const issues = [
      ...featureStatic.issues,
      ...featureExec.issues,
      ...regressionStatic.issues,
      ...regressionExec.issues,
    ];

    return {
      status: issues.length === 0 ? "passed" : "blocked",
      artifacts: [],
      evidenceRefs: regressionExec.outputs.map((output) => output.command),
      nextActions: issues.length === 0
        ? ["Proceed to delivery."]
        : ["Fix validation failures before delivery."],
      blockedReason: issues.length === 0
        ? undefined
        : {
            code: "validation_failed",
            message: issues[0] ?? "Validation failed.",
            requiredAction: "Resolve failing validation commands and retry.",
            evidence: issues,
          },
      validation: {
        featureValidation: featureExec,
        regressionValidation: regressionExec,
      },
    };
  }
}
