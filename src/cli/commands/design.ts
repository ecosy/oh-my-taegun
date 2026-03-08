import { loadDocuments } from "../../config/load-documents.js";
import { detectCapabilities } from "../../intake/detect-capabilities.js";
import { resolveRepository } from "../../intake/resolve-repo.js";
import { evaluateTraceability } from "../../validation/traceability-gate.js";

export async function runDesignCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  const documents = await loadDocuments(projectRoot, args.profile);
  const repository = await resolveRepository({
    gitUrl: args["git-url"],
    repoPath: args["repo-path"],
    workingRoot: projectRoot,
  });
  const capabilities = await detectCapabilities(repository.localWorkspace);
  const traceability = evaluateTraceability(documents);

  process.stdout.write(
    JSON.stringify(
      {
        mode: "design",
        repository,
        capabilities,
        traceability,
      },
      null,
      2,
    ) + "\n",
  );
}
