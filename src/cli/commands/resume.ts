import { latestHandoff } from "../../state/handoff-store.js";
import { latestSnapshot } from "../../state/snapshot-store.js";
import { readRunStateById } from "../../state/state-store.js";
import { CliError } from "../../shared/errors.js";
import { loadProfile } from "../../config/load-profile.js";
import { prepareV2Resume } from "../../v2/recovery.js";
import { readV2RunStateById } from "../../v2/state-store.js";

export async function runResumeCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  const repoPath = args["repo-path"];
  const runId = args["run-id"];
  if (!repoPath || !runId) {
    throw new CliError("resume requires --repo-path and --run-id");
  }
  const profilePath = args.profile ?? "docs/spec.yaml";
  const profile = await loadProfile(projectRoot, profilePath);
  if (profile.version === 2) {
    const runState = await readV2RunStateById(repoPath, runId);
    const resume = await prepareV2Resume(repoPath, runId);
    process.stdout.write(
      JSON.stringify(
        {
          mode: "resume",
          profileVersion: 2,
          runId,
          phase: resume.phase,
          executionModelPolicy: resume.executionModelPolicy ?? runState.executionModelPolicy,
          snapshot: resume.snapshot,
          handoff: resume.handoff,
          nextActions: resume.nextActions,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const runState = await readRunStateById(repoPath, runId);
  const snapshot = await latestSnapshot(repoPath, runId);
  const handoff = await latestHandoff(repoPath, runId);

  process.stdout.write(
    JSON.stringify(
      {
        mode: "resume",
        requestedRunId: runId,
        currentRunState: runState.run_id,
        snapshot,
        handoff,
      },
      null,
      2,
    ) + "\n",
  );
}
