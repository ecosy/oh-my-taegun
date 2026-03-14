import { runDoctor } from "../../v2/doctor.js";

export async function runDoctorCommand(projectRoot: string, args: Record<string, string>): Promise<void> {
  const result = await runDoctor({
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

  process.stdout.write(
    JSON.stringify(
      {
        mode: "doctor",
        profileVersion: 2,
        repository: result.repository,
        modelEnvironmentSurvey: result.modelEnvironmentSurvey,
        gitRuntimeContext: result.gitRuntimeContext,
        preflightChecks: result.preflightChecks,
        credentialGaps: result.credentialGaps,
        verifiedCapabilityReport: result.verifiedCapabilityReport,
      },
      null,
      2,
    ) + "\n",
  );
}
