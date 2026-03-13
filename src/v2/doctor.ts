import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { currentBranch } from "../delivery/git-client.js";
import { resolveRepository } from "../intake/resolve-repo.js";
import { CliError } from "../shared/errors.js";
import type { RepositoryContext } from "../shared/types.js";
import { normalizeModelSurvey, type ModelPolicyInput } from "./model-policy.js";
import { inspectCapabilities } from "./inspect.js";
import type { DoctorResult, ModelEnvironmentSurvey } from "./types.js";

const execFileAsync = promisify(execFile);

export interface DoctorOptions extends ModelPolicyInput {
  projectRoot: string;
  gitUrl?: string;
  repoPath?: string;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  if (!options.gitUrl && !options.repoPath) {
    throw new CliError("doctor requires --repo-path or --git-url");
  }

  const repository = await resolveRepository({
    gitUrl: options.gitUrl,
    repoPath: options.repoPath,
    workingRoot: options.projectRoot,
  });
  const modelEnvironmentSurvey = buildSurvey(options);
  const verifiedCapabilityReport = await inspectCapabilities(repository.localWorkspace);
  const gitRuntimeContext = await buildGitRuntimeContext(repository);
  const credentialGaps = collectCredentialGaps(verifiedCapabilityReport, modelEnvironmentSurvey);

  return {
    repository,
    modelEnvironmentSurvey,
    gitRuntimeContext,
    credentialGaps,
    verifiedCapabilityReport,
  };
}

function buildSurvey(options: ModelPolicyInput): ModelEnvironmentSurvey {
  const survey = normalizeModelSurvey({
    surveyModels: options.surveyModels ?? process.env.OMT_SURVEY_MODELS,
    approvedModels: options.approvedModels ?? process.env.OMT_APPROVED_MODELS,
    reasoningEfforts: options.reasoningEfforts ?? process.env.OMT_REASONING_EFFORTS,
  });

  if (survey.surveyedModels.length === 0) {
    const defaultModels = [process.env.OMT_CODEX_MODEL].filter((value): value is string => Boolean(value));
    survey.surveyedModels = defaultModels;
    if (survey.approvedModels.length === 0 && defaultModels.length === 1) {
      survey.approvedModels = defaultModels;
    }
  }

  return survey;
}

async function buildGitRuntimeContext(repository: RepositoryContext): Promise<DoctorResult["gitRuntimeContext"]> {
  const status = await execFileAsync("git", ["status", "--short"], { cwd: repository.localWorkspace });
  const branch = await currentBranch(repository.localWorkspace).catch(() => undefined);

  return {
    workingTreeClean: status.stdout.trim().length === 0,
    currentBranch: branch,
  };
}

function collectCredentialGaps(result: DoctorResult["verifiedCapabilityReport"], survey: ModelEnvironmentSurvey): string[] {
  const gaps: string[] = [];
  if (survey.approvedModels.length === 0) {
    gaps.push("No approved model policy was confirmed.");
  }
  if (result.verified.testCommands.length === 0) {
    gaps.push("No verified test command was detected.");
  }
  return gaps;
}
