import type { ValidationExecutionResult } from "../shared/types.js";
import type { ReviewerDecision, VerifierDecision } from "./types.js";

export function buildReviewerDecision(input: {
  changedFiles: string[];
  featureValidation: ValidationExecutionResult;
  regressionValidation: ValidationExecutionResult;
  verifierDecisions: VerifierDecision[];
}): ReviewerDecision {
  const forced = process.env.OMT_REVIEWER_STATUS;
  if (forced === "block" || forced === "rework") {
    return {
      status: forced,
      summary: `Reviewer requested ${forced} before promotion.`,
      findings: ["Forced reviewer outcome from environment override."],
      nextActions: ["Adjust the implementation or reviewer configuration before rerunning."],
      evidenceRefs: [],
    };
  }

  if (input.verifierDecisions.some((decision) => !decision.passed)) {
    return {
      status: "block",
      summary: "Reviewer blocked promotion because verifier gates are not passing.",
      findings: input.verifierDecisions.flatMap((decision) => decision.reasons),
      nextActions: ["Resolve verifier and validation failures before promotion."],
      evidenceRefs: [],
    };
  }

  if (!input.featureValidation.passed || !input.regressionValidation.passed) {
    return {
      status: "block",
      summary: "Reviewer blocked promotion because validations failed.",
      findings: [...input.featureValidation.issues, ...input.regressionValidation.issues],
      nextActions: ["Resolve failing validation commands before promotion."],
      evidenceRefs: [],
    };
  }

  if (input.changedFiles.length === 0) {
    return {
      status: "rework",
      summary: "Reviewer requested rework because no changed files were recorded.",
      findings: ["No changed files were recorded for reviewer inspection."],
      nextActions: ["Review the execution output and rerun after changes are produced."],
      evidenceRefs: [],
    };
  }

  return {
    status: "pass",
    summary: "Reviewer approved promotion based on local diff and validation outputs.",
    findings: [],
    nextActions: [],
    evidenceRefs: [...input.changedFiles],
  };
}
