import { runNightly } from "../../orchestrator/run-engine.js";
import { loadProfile } from "../../config/load-profile.js";
import { runV2Nightly } from "../../v2/run-engine.js";

export async function runRunCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  const profilePath = args.profile ?? "docs/spec.yaml";
  const profile = await loadProfile(projectRoot, profilePath);
  if (profile.version === 2) {
    const outcome = await runV2Nightly({
      projectRoot,
      profilePath,
      gitUrl: args["git-url"],
      repoPath: args["repo-path"],
    });

    process.stdout.write(
      JSON.stringify(
        {
          mode: "run",
          profileVersion: 2,
          runId: outcome.runState.runId,
          phase: outcome.runState.phase,
          status: outcome.runState.status,
          verifierDecisions: outcome.runState.verifierDecisions,
          blockedReasons: outcome.runState.blockedReasons,
          reportPath: outcome.reportPath,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const outcome = await runNightly({
    projectRoot,
    profilePath,
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
