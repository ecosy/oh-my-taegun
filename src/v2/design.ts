import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DocumentSet, RepositoryContext } from "../shared/types.js";
import { buildOntologySeed } from "./ontology.js";
import { v2DesignInterviewPath, v2DesignModelSurveyPath, v2OntologyPath, v2SeedPath } from "./files.js";
import { calculateAmbiguityScore } from "./metrics.js";
import { buildExecutionModelPolicy, buildModelPolicyQuestionRecords, type ModelPolicyInput } from "./model-policy.js";
import type { BlockedReason } from "../shared/types.js";
import type { DesignPackage, DoctorResult } from "./types.js";

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
  const questionRecords = buildModelPolicyQuestionRecords(doctor.modelEnvironmentSurvey, policy);
  const ambiguityScorecard = calculateAmbiguityScore({
    openQuestions: questionRecords.filter((record) => !record.answer).map((record) => record.question),
    requiredSlots: {
      goal: documents.requirements.requirements.length > 0,
      constraints: doctor.verifiedCapabilityReport.classification !== "blocked",
      successCriteria: documents.acceptance.acceptance_criteria.length > 0,
    },
    policy,
    verifiedCapabilityReport: doctor.verifiedCapabilityReport,
    threshold: readAmbiguityThreshold(documents),
  });
  const ontologySeed = buildOntologySeed(documents, policy);

  const blockedReasons = collectBlockedReasons(policy.openQuestions, ambiguityScorecard);

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

function collectBlockedReasons(openQuestions: string[], ambiguityScorecard: V2DesignResult["ambiguityScorecard"]): BlockedReason[] {
  const reasons: BlockedReason[] = [];
  if (openQuestions.length > 0) {
    reasons.push({
      code: "model_policy_unconfirmed",
      message: openQuestions[0] ?? "Execution model policy is incomplete.",
      requiredAction: "Complete model policy inputs before seed freeze.",
      evidence: openQuestions,
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

async function writeJson(path: string, payload: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(payload, null, 2));
}

async function appendInterviewRecords(path: string, records: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const lines = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  await writeFile(path, lines);
}
