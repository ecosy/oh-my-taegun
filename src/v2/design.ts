import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DocumentSet, RepositoryContext } from "../shared/types.js";
import { buildOntologySeed } from "./ontology.js";
import { v2DesignInterviewPath, v2DesignModelSurveyPath, v2OntologyPath, v2SeedPath } from "./files.js";
import { calculateAmbiguityScore } from "./metrics.js";
import { buildExecutionModelPolicy, buildModelPolicyQuestionRecords, type ModelPolicyInput } from "./model-policy.js";
import type { BlockedReason } from "../shared/types.js";
import type { DesignPackage, DoctorResult, QuestionRecord } from "./types.js";

export interface V2DesignResult {
  repository: RepositoryContext;
  modelEnvironmentSurvey: DoctorResult["modelEnvironmentSurvey"];
  executionModelPolicy: DesignPackage["executionModelPolicy"];
  ambiguityScorecard: DesignPackage["ambiguityScorecard"];
  ontologySeed: DesignPackage["ontologySeed"];
  designPackagePath?: string;
  openQuestions: string[];
  status: "passed" | "blocked";
  blockedReasons: BlockedReason[];
}

export async function runV2Design(
  documents: DocumentSet,
  doctor: DoctorResult,
  input: ModelPolicyInput,
): Promise<V2DesignResult> {
  const policy = buildExecutionModelPolicy(documents, doctor.modelEnvironmentSurvey, input);
  const questionRecords = [
    ...buildDesignQuestionRecords(documents, doctor),
    ...buildModelPolicyQuestionRecords(doctor.modelEnvironmentSurvey, policy, input),
  ];
  const ambiguityScorecard = calculateAmbiguityScore({
    questions: questionRecords,
    threshold: readAmbiguityThreshold(documents),
    weights: readAmbiguityWeights(documents),
  });
  const ontologySeed = buildOntologySeed(documents, policy);

  const blockedReasons = collectBlockedReasons(ambiguityScorecard);

  await writeJson(v2DesignModelSurveyPath(doctor.repository.localWorkspace), doctor.modelEnvironmentSurvey);
  await appendInterviewRecords(v2DesignInterviewPath(doctor.repository.localWorkspace), questionRecords);
  await writeJson(v2OntologyPath(doctor.repository.localWorkspace), ontologySeed);

  let designPackagePath: string | undefined;
  if (blockedReasons.length === 0) {
    const designPackage: DesignPackage = {
      repository: doctor.repository,
      verifiedCapabilityReport: doctor.verifiedCapabilityReport,
      executionModelPolicy: policy,
      ambiguityScorecard,
      ontologySeed,
      openQuestionCount: ambiguityScorecard.openQuestions.length,
      approvalRecord: {
        frozen: true,
        blockedReasons: [],
      },
    };
    designPackagePath = v2SeedPath(doctor.repository.localWorkspace);
    await writeJson(designPackagePath, designPackage);
  }

  return {
    repository: doctor.repository,
    modelEnvironmentSurvey: doctor.modelEnvironmentSurvey,
    executionModelPolicy: policy,
    ambiguityScorecard,
    ontologySeed,
    designPackagePath,
    openQuestions: ambiguityScorecard.openQuestions,
    status: blockedReasons.length === 0 ? "passed" : "blocked",
    blockedReasons,
  };
}

function readAmbiguityThreshold(documents: DocumentSet): number {
  const metrics = (documents.metrics ?? {}) as Record<string, any>;
  const threshold = metrics.ambiguity?.threshold;
  return typeof threshold === "number" ? threshold : 0.2;
}

function readAmbiguityWeights(documents: DocumentSet): Record<string, number> {
  const metrics = (documents.metrics ?? {}) as Record<string, any>;
  const weights = metrics.ambiguity?.weights;
  return typeof weights === "object" && weights ? weights as Record<string, number> : {
    goal_clarity: 0.35,
    constraint_clarity: 0.25,
    success_criteria: 0.2,
    capability_clarity: 0.1,
    model_policy_clarity: 0.1,
  };
}

function collectBlockedReasons(ambiguityScorecard: V2DesignResult["ambiguityScorecard"]): BlockedReason[] {
  const reasons: BlockedReason[] = [];
  if ((ambiguityScorecard.blockingQuestions?.length ?? 0) > 0) {
    reasons.push({
      code: "model_policy_unconfirmed",
      message: ambiguityScorecard.blockingQuestions?.[0] ?? "Execution model policy is incomplete.",
      requiredAction: "Complete model policy inputs before seed freeze.",
      evidence: ambiguityScorecard.blockingQuestions,
    });
  }
  if (!ambiguityScorecard.passed) {
    reasons.push({
      code: "ambiguity_above_threshold",
      message: `Ambiguity score ${ambiguityScorecard.score} exceeds threshold ${ambiguityScorecard.threshold}.`,
      requiredAction: "Close open design questions before seed freeze.",
      evidence: ambiguityScorecard.openQuestions,
    });
  }
  return reasons;
}

function buildDesignQuestionRecords(documents: DocumentSet, doctor: DoctorResult): QuestionRecord[] {
  return [
    {
      id: "design-goal",
      question: "Is there at least one concrete requirement defining the goal?",
      answer: documents.requirements.requirements.length > 0 ? `${documents.requirements.requirements.length} requirements loaded` : undefined,
      required: true,
      source: "system",
      slot: "goal_clarity",
      status: documents.requirements.requirements.length > 0 ? "answered" : "unanswered",
      blocking: documents.requirements.requirements.length === 0,
    },
    {
      id: "design-constraints",
      question: "Are runtime and repository constraints known enough to plan work safely?",
      answer: doctor.verifiedCapabilityReport.classification,
      required: true,
      source: "doctor",
      slot: "constraint_clarity",
      status: doctor.verifiedCapabilityReport.classification === "blocked" ? "unanswered" : "verified",
      blocking: doctor.verifiedCapabilityReport.classification === "blocked",
    },
    {
      id: "design-success-criteria",
      question: "Are acceptance criteria loaded for this design package?",
      answer: documents.acceptance.acceptance_criteria.length > 0
        ? `${documents.acceptance.acceptance_criteria.length} acceptance criteria loaded`
        : undefined,
      required: true,
      source: "system",
      slot: "success_criteria",
      status: documents.acceptance.acceptance_criteria.length > 0 ? "answered" : "unanswered",
      blocking: documents.acceptance.acceptance_criteria.length === 0,
    },
    {
      id: "design-capability",
      question: "Is there verified capability evidence for test execution?",
      answer: doctor.verifiedCapabilityReport.verified.testCommands.join(", "),
      required: true,
      source: "doctor",
      slot: "capability_clarity",
      status: doctor.verifiedCapabilityReport.verified.testCommands.length > 0 ? "verified" : "assumed",
      blocking: false,
    },
  ];
}

async function writeJson(path: string, payload: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(payload, null, 2));
}

async function appendInterviewRecords(path: string, records: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const lines = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  await writeFile(path, lines);
}
