import { runNightly } from "../../orchestrator/run-engine.js";

export async function runRunCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  const outcome = await runNightly({
    projectRoot,
    profilePath: args.profile,
    gitUrl: args["git-url"],
    repoPath: args["repo-path"],
  });

  process.stdout.write(
    JSON.stringify(
      {
        mode: "run",
        runId: outcome.runState.run_id,
        status: outcome.runState.status,
        blockedReasons: outcome.runState.blocked_reasons,
        blockedReportPath: outcome.blockedReportPath,
      },
      null,
      2,
    ) + "\n",
  );
}
