import { latestHandoff } from "../../state/handoff-store.js";
import { latestSnapshot } from "../../state/snapshot-store.js";
import { readRunStateById } from "../../state/state-store.js";
import { CliError } from "../../shared/errors.js";

export async function runResumeCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  const repoPath = args["repo-path"];
  const runId = args["run-id"];
  if (!repoPath || !runId) {
    throw new CliError("resume requires --repo-path and --run-id");
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
