import { readEvidence } from "../../state/evidence-store.js";
import { readRunState, readRunStateById } from "../../state/state-store.js";
import { CliError } from "../../shared/errors.js";
import { loadProfile } from "../../config/load-profile.js";
import { readV2RunState, readV2RunStateById } from "../../v2/state-store.js";

export async function runReportCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  const repoPath = args["repo-path"];
  if (!repoPath) {
    throw new CliError("report requires --repo-path");
  }
  const profilePath = args.profile ?? "docs/spec.yaml";
  const profile = await loadProfile(projectRoot, profilePath);
  if (profile.version === 2) {
    const runState = args["run-id"] ? await readV2RunStateById(repoPath, args["run-id"]) : await readV2RunState(repoPath);
    process.stdout.write(
      JSON.stringify(
        {
          mode: "report",
          profileVersion: 2,
          runId: runState.runId,
          executionModelPolicy: runState.executionModelPolicy,
          deliveryPolicy: runState.deliveryPolicy,
          ambiguityScorecard: runState.ambiguityScorecard,
          convergenceSnapshot: runState.convergenceSnapshot,
          pathologySignals: runState.pathologySignals,
          validationSummary: runState.validationSummary,
          reviewerDecision: runState.reviewerDecision,
          stageTimeline: runState.deliveryStatus.stageResults,
          currentStage: runState.deliveryStatus.currentStage,
          completedStages: runState.deliveryStatus.completedStages,
          failedStage: runState.deliveryStatus.failedStage,
          deliveryStatus: runState.deliveryStatus,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const runState = args["run-id"] ? await readRunStateById(repoPath, args["run-id"]) : await readRunState(repoPath);
  const evidence = await readEvidence(repoPath);

  process.stdout.write(
    JSON.stringify(
      {
        mode: "report",
        runState,
        evidenceCount: evidence.entries.length,
      },
      null,
      2,
    ) + "\n",
  );
}
