import type { ValidationExecutionResult } from "../shared/types.js";
import type { ExecutionModelPolicy, VerifiedCapabilityReport, VerifierDecision } from "./types.js";

export function buildVerifierDecisions(input: {
  convergenceSnapshot: {
    converged: boolean;
    ontologyDriftDetected: boolean;
  };
  featureValidation: ValidationExecutionResult;
  regressionValidation: ValidationExecutionResult;
  executionModelPolicy: ExecutionModelPolicy;
  verifiedCapabilityReport: VerifiedCapabilityReport;
}): VerifierDecision[] {
  const decisions: VerifierDecision[] = [];

  if (input.executionModelPolicy.openQuestions.length > 0 || input.verifiedCapabilityReport.verified.testCommands.length === 0) {
    decisions.push({
      id: "verifier_block",
      passed: false,
      reasons: [
        ...input.executionModelPolicy.openQuestions,
        ...(input.verifiedCapabilityReport.verified.testCommands.length === 0 ? ["Missing verified test commands."] : []),
      ],
    });
    return decisions;
  }

  if (input.convergenceSnapshot.ontologyDriftDetected) {
    decisions.push({
      id: "verifier_replan",
      passed: false,
      reasons: ["Ontology drift detected."],
    });
  }

  if (input.featureValidation.passed && input.regressionValidation.passed && input.convergenceSnapshot.converged) {
    decisions.push({
      id: "verifier_pass",
      passed: true,
      reasons: [],
    });
  } else if (!decisions.some((decision) => decision.id === "verifier_replan")) {
    decisions.push({
      id: "verifier_block",
      passed: false,
      reasons: [
        ...input.featureValidation.issues,
        ...input.regressionValidation.issues,
      ],
    });
  }

  return decisions;
}
