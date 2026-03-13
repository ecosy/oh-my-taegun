import type { AmbiguityScorecard, ExecutionModelPolicy, VerifiedCapabilityReport } from "./types.js";

export function calculateAmbiguityScore(input: {
  openQuestions: string[];
  requiredSlots: Record<string, boolean>;
  policy: ExecutionModelPolicy;
  verifiedCapabilityReport: VerifiedCapabilityReport;
  threshold?: number;
}): AmbiguityScorecard {
  const threshold = input.threshold ?? 0.2;
  const slots = {
    goal_clarity: slotScore(input.requiredSlots.goal),
    constraint_clarity: slotScore(input.requiredSlots.constraints),
    success_criteria: slotScore(input.requiredSlots.successCriteria),
    capability_clarity: input.verifiedCapabilityReport.verified.testCommands.length > 0 ? 1 : 0.5,
    model_policy_clarity: input.policy.openQuestions.length === 0 ? 1 : 0,
  };
  const score = 1 - (
    slots.goal_clarity * 0.35 +
    slots.constraint_clarity * 0.25 +
    slots.success_criteria * 0.2 +
    slots.capability_clarity * 0.1 +
    slots.model_policy_clarity * 0.1
  );

  return {
    threshold,
    score: Number(score.toFixed(3)),
    slots,
    openQuestions: [...input.openQuestions, ...input.policy.openQuestions],
    passed: score <= threshold && input.policy.openQuestions.length === 0,
  };
}

function slotScore(filled: boolean): number {
  return filled ? 1 : 0;
}
