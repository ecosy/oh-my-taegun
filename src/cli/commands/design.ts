import { loadDocuments } from "../../config/load-documents.js";
import { detectCapabilities } from "../../intake/detect-capabilities.js";
import { resolveRepository } from "../../intake/resolve-repo.js";
import { evaluateTraceability } from "../../validation/traceability-gate.js";
import { runDoctor } from "../../v2/doctor.js";
import { runV2Design } from "../../v2/design.js";
import { resolveDesignInterviewInput } from "../../v2/interview.js";

export async function runDesignCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  const documents = await loadDocuments(projectRoot, args.profile);
  if (documents.profile.version === 2) {
    const doctor = await runDoctor({
      projectRoot,
      gitUrl: args["git-url"],
      repoPath: args["repo-path"],
      surveyModels: args["survey-models"],
      approvedModels: args["approved-models"],
      designModel: args["design-model"],
      executionModel: args["execution-model"],
      verifierModel: args["verifier-model"],
      reasoningEfforts: args["reasoning-efforts"],
      fallbackChain: args["fallback-chain"],
      workUnitBudgetProfile: args["work-unit-budget-profile"],
    });
    const interviewInput = await resolveDesignInterviewInput({
      args,
      documents,
      doctor,
    });
    const result = await runV2Design(documents, doctor, {
      modelPolicy: interviewInput.modelPolicy,
      deliveryPolicy: interviewInput.deliveryPolicy,
    });

    process.stdout.write(
      JSON.stringify(
        {
          mode: "design",
          profileVersion: 2,
          repository: result.repository,
          modelEnvironmentSurvey: result.modelEnvironmentSurvey,
          executionModelPolicy: result.executionModelPolicy,
          deliveryPolicy: result.deliveryPolicy,
          ambiguityScorecard: result.ambiguityScorecard,
          ontologySeed: result.ontologySeed,
          designPackagePath: result.designPackagePath,
          openQuestions: result.openQuestions,
          status: result.status,
          blockedReasons: result.blockedReasons,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

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
