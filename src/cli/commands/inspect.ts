import { resolveRepository } from "../../intake/resolve-repo.js";
import { CliError } from "../../shared/errors.js";
import { inspectCapabilities } from "../../v2/inspect.js";

export async function runInspectCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  if (!args["repo-path"] && !args["git-url"]) {
    throw new CliError("inspect requires --repo-path or --git-url");
  }

  const repository = await resolveRepository({
    gitUrl: args["git-url"],
    repoPath: args["repo-path"],
    workingRoot: projectRoot,
  });
  const verifiedCapabilityReport = await inspectCapabilities(repository.localWorkspace);

  process.stdout.write(
    JSON.stringify(
      {
        mode: "inspect",
        profileVersion: 2,
        repository,
        verifiedCapabilityReport,
        evidenceRefs: verifiedCapabilityReport.evidenceRefs,
      },
      null,
      2,
    ) + "\n",
  );
}
