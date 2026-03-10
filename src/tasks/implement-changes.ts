import { CodexCliAdapter } from "../llm/codex-cli-adapter.js";
import { executeImplementationLoop } from "../orchestrator/loop-controller.js";
import type { ExecutableTask, TaskExecutionContext, TaskExecutionOutput } from "./types.js";

export class ImplementChangesTask implements ExecutableTask {
  readonly id = "implement-changes";

  async execute(context: TaskExecutionContext): Promise<TaskExecutionOutput> {
    if (!context.runState) {
      return {
        status: "blocked",
        artifacts: [],
        evidenceRefs: [],
        nextActions: ["Initialize run state before implement-changes."],
        blockedReason: {
          code: "implementation_missing_run_state",
          message: "Run state was not prepared before implement-changes.",
          requiredAction: "Construct run state before invoking the LLM loop.",
        },
      };
    }

    const adapter = new CodexCliAdapter(context.documents);
    const result = await executeImplementationLoop({
      documents: context.documents,
      repository: context.repository,
      runId: context.runId,
      runState: context.runState,
      executor: adapter,
    });

    return {
      status: result.status,
      artifacts: result.artifacts,
      evidenceRefs: result.evidenceRefs,
      nextActions: result.nextActions,
      blockedReason: result.blockedReason,
      implementation: {
        totalWorkUnits: result.totalWorkUnits,
        completedWorkUnits: result.completedWorkUnits,
        currentWorkUnitId: result.currentWorkUnitId,
        completedRequirementIds: result.completedRequirementIds,
        blockedRequirementIds: result.blockedRequirementIds,
        changedFiles: result.changedFiles,
        sessionIds: result.sessionIds,
        validationArtifacts: result.validationArtifacts,
        lastAttempt: result.lastAttempt,
      },
    };
  }
}
