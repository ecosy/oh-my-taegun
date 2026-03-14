import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { currentBranch } from "../delivery/git-client.js";
import { resolveRepository } from "../intake/resolve-repo.js";
import { CliError } from "../shared/errors.js";
import type { RepositoryContext } from "../shared/types.js";
import { normalizeModelSurvey } from "./model-policy.js";
import { inspectCapabilities } from "./inspect.js";
import type { DoctorResult, ModelEnvironmentSurvey, ModelPolicyInput } from "./types.js";

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
  const preflightChecks = [
    {
      code: "working_tree_clean",
      passed: gitRuntimeContext.workingTreeClean,
      message: gitRuntimeContext.workingTreeClean
        ? "Working tree is clean."
        : "Working tree has uncommitted changes.",
    },
    {
      code: "default_branch_detected",
      passed: Boolean(repository.defaultBranch),
      message: repository.defaultBranch
        ? `Default branch resolved to ${repository.defaultBranch}.`
        : "Default branch could not be resolved.",
    },
    {
      code: "lockfile_detected",
      passed: await hasLockfile(repository.localWorkspace),
      message: await hasLockfile(repository.localWorkspace)
        ? "At least one package-manager lockfile is present."
        : "No package-manager lockfile was detected.",
    },
    {
      code: "verified_test_commands",
      passed: verifiedCapabilityReport.verified.testCommands.length > 0,
      message: verifiedCapabilityReport.verified.testCommands.length > 0
        ? "Verified test commands are available."
        : "No verified test command was detected.",
    },
    {
      code: "workspace_writable",
      passed: await isWorkspaceWritable(repository.localWorkspace),
      message: await isWorkspaceWritable(repository.localWorkspace)
        ? "Workspace directory is writable."
        : "Workspace directory is not writable.",
    },
  ];
  const credentialGaps = collectCredentialGaps(verifiedCapabilityReport, modelEnvironmentSurvey);

  return {
    repository,
    modelEnvironmentSurvey,
    gitRuntimeContext,
    preflightChecks,
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

function collectCredentialGaps(result: DoctorResult["verifiedCapabilityReport"], survey: ModelEnvironmentSurvey): DoctorResult["credentialGaps"] {
  const gaps: DoctorResult["credentialGaps"] = [];
  if (survey.approvedModels.length === 0) {
    gaps.push({
      code: "missing_approved_models",
      message: "No approved model policy was confirmed.",
      severity: "blocking",
    });
  }
  if (result.verified.testCommands.length === 0) {
    gaps.push({
      code: "missing_verified_tests",
      message: "No verified test command was detected.",
      severity: "blocking",
    });
  }
  return gaps;
}

async function hasLockfile(workspace: string): Promise<boolean> {
  const candidates = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
  for (const candidate of candidates) {
    try {
      await access(join(workspace, candidate), constants.F_OK);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function isWorkspaceWritable(workspace: string): Promise<boolean> {
  try {
    await access(workspace, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
