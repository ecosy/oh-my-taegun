import type { DocumentSet } from "../shared/types.js";
import type { ExecutionModelPolicy, ModelEnvironmentSurvey, QuestionRecord, WorkUnitBudget } from "./types.js";

export interface ModelPolicyInput {
  surveyModels?: string;
  approvedModels?: string;
  designModel?: string;
  executionModel?: string;
  verifierModel?: string;
  reasoningEfforts?: string;
  fallbackChain?: string;
  workUnitBudgetProfile?: string;
}

export function normalizeModelSurvey(input: ModelPolicyInput): ModelEnvironmentSurvey {
  const surveyedModels = parseList(input.surveyModels);
  const approvedModels = parseList(input.approvedModels);
  const reasoningEfforts = parseList(input.reasoningEfforts);
  const inferredApprovedModels = approvedModels.length === 0 && surveyedModels.length === 1 ? [...surveyedModels] : approvedModels;

  return {
    surveyedAt: new Date().toISOString(),
    surveyedModels,
    approvedModels: inferredApprovedModels,
    reasoningEfforts: reasoningEfforts.length > 0 ? reasoningEfforts : ["medium"],
    constraints: [],
    verifierModelAllowed: true,
    source: input.surveyModels || input.approvedModels || input.reasoningEfforts ? "cli" : "fallback",
  };
}

export function buildExecutionModelPolicy(
  documents: DocumentSet,
  survey: ModelEnvironmentSurvey,
  input: ModelPolicyInput,
): ExecutionModelPolicy {
  const contracts = (documents.modelContracts ?? {}) as Record<string, any>;
  const profiles = (contracts.budget_profiles ?? {}) as Record<string, any>;
  const requestedProfile = input.workUnitBudgetProfile ?? inferBudgetProfile(survey);
  const budgetProfile = profiles[requestedProfile] ? requestedProfile : "low_capability";
  const budget = normalizeBudget(budgetProfile, profiles[budgetProfile] ?? {});
  const fallbackModels = parseList(input.fallbackChain).filter((model) => survey.approvedModels.includes(model));
  const inferredSingleModel = survey.approvedModels.length === 1 ? survey.approvedModels[0] : undefined;
  const defaultExecutionModel = input.executionModel ?? inferredSingleModel;
  const defaultDesignModel = input.designModel ?? defaultExecutionModel;
  const defaultVerifierModel = input.verifierModel ?? defaultExecutionModel;
  const openQuestions = collectPolicyOpenQuestions({
    survey,
    defaultDesignModel,
    defaultExecutionModel,
    defaultVerifierModel,
  });

  return {
    surveyedModels: survey.surveyedModels,
    approvedModels: survey.approvedModels,
    defaultDesignModel,
    defaultExecutionModel,
    defaultVerifierModel,
    allowedReasoningEfforts: survey.reasoningEfforts,
    fallbackChain: {
      models: fallbackModels,
    },
    maxAttemptsByPhase: {
      design: budget.maxAttempts,
      execute: budget.maxAttempts,
      verify: 2,
    },
    workUnitBudgetProfile: budget.profile,
    workUnitBudget: budget,
    requiresManualOverrideFor: openQuestions.length > 0 ? ["seed_freeze"] : [],
    recordedAt: new Date().toISOString(),
    openQuestions,
  };
}

export function buildModelPolicyQuestionRecords(
  survey: ModelEnvironmentSurvey,
  policy: ExecutionModelPolicy,
  input?: ModelPolicyInput,
): QuestionRecord[] {
  const approvedExplicit = parseList(input?.approvedModels).length > 0;
  const designExplicit = Boolean(input?.designModel);
  const executionExplicit = Boolean(input?.executionModel);
  const verifierExplicit = Boolean(input?.verifierModel);

  return [
    {
      id: "model-survey",
      question: "Which models are available in the current operator environment?",
      answer: survey.surveyedModels.join(", "),
      required: true,
      source: "doctor",
      slot: "model_policy_clarity",
      status: survey.surveyedModels.length > 0 ? "verified" : "unanswered",
      blocking: survey.surveyedModels.length === 0,
    },
    {
      id: "model-approved",
      question: "Which models are approved for this run?",
      answer: survey.approvedModels.join(", "),
      required: true,
      source: "operator",
      slot: "model_policy_clarity",
      status: survey.approvedModels.length === 0 ? "unanswered" : approvedExplicit ? "answered" : "assumed",
      blocking: survey.approvedModels.length === 0,
    },
    {
      id: "model-default-execution",
      question: "Which execution model should be used for this run?",
      answer: policy.defaultExecutionModel,
      required: true,
      source: "operator",
      slot: "model_policy_clarity",
      status: !policy.defaultExecutionModel ? "unanswered" : executionExplicit ? "answered" : "assumed",
      blocking: !policy.defaultExecutionModel,
    },
    {
      id: "model-default-verifier",
      question: "Which verifier model should be used for this run?",
      answer: policy.defaultVerifierModel,
      required: true,
      source: "operator",
      slot: "model_policy_clarity",
      status: !policy.defaultVerifierModel ? "unanswered" : verifierExplicit ? "answered" : "assumed",
      blocking: !policy.defaultVerifierModel,
    },
    {
      id: "model-default-design",
      question: "Which design model should be used for this run?",
      answer: policy.defaultDesignModel,
      required: true,
      source: "operator",
      slot: "model_policy_clarity",
      status: !policy.defaultDesignModel ? "unanswered" : designExplicit ? "answered" : "assumed",
      blocking: !policy.defaultDesignModel,
    },
  ];
}

function collectPolicyOpenQuestions(input: {
  survey: ModelEnvironmentSurvey;
  defaultDesignModel?: string;
  defaultExecutionModel?: string;
  defaultVerifierModel?: string;
}): string[] {
  const questions: string[] = [];
  if (input.survey.surveyedModels.length === 0) {
    questions.push("No surveyed models were captured.");
  }
  if (input.survey.approvedModels.length === 0) {
    questions.push("No approved models were confirmed.");
  }
  if (input.survey.approvedModels.length > 1 && !input.defaultExecutionModel) {
    questions.push("Default execution model must be selected when multiple approved models exist.");
  }
  if (!input.defaultDesignModel) {
    questions.push("Default design model is missing.");
  }
  if (!input.defaultExecutionModel) {
    questions.push("Default execution model is missing.");
  }
  if (!input.defaultVerifierModel) {
    questions.push("Default verifier model is missing.");
  }
  return questions;
}

function inferBudgetProfile(survey: ModelEnvironmentSurvey): string {
  return survey.approvedModels.length > 1 ? "high_capability" : "low_capability";
}

function normalizeBudget(profile: string, raw: Record<string, unknown>): WorkUnitBudget {
  return {
    profile,
    maxRequirementIds: asNumber(raw.max_requirement_ids, 1),
    maxAcceptanceIds: asNumber(raw.max_acceptance_ids, 2),
    maxChangedFiles: asNumber(raw.max_changed_files, 4),
    maxValidationCommands: asNumber(raw.max_validation_commands, 2),
    maxAttempts: asNumber(raw.max_attempts, 3),
    maxOpenQuestionsPerRound: asNumber(raw.max_open_questions_per_round, 5),
  };
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  )];
}
