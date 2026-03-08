import { readEvidence } from "../../state/evidence-store.js";
import { readRunState, readRunStateById } from "../../state/state-store.js";
import { CliError } from "../../shared/errors.js";

export async function runReportCommand(_projectRoot: string, args: Record<string, string>): Promise<void> {
  const repoPath = args["repo-path"];
  if (!repoPath) {
    throw new CliError("report requires --repo-path");
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
