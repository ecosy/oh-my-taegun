import type { AmbiguityScorecard, QuestionRecord } from "./types.js";

export function calculateAmbiguityScore(input: {
  questions: QuestionRecord[];
  threshold?: number;
  weights?: Record<string, number>;
}): AmbiguityScorecard {
  const threshold = input.threshold ?? 0.2;
  const weights = input.weights ?? {
    goal_clarity: 0.35,
    constraint_clarity: 0.25,
    success_criteria: 0.2,
    capability_clarity: 0.1,
    model_policy_clarity: 0.1,
  };
  const slots = scoreSlots(input.questions, weights);
  const weightedClarity = Object.entries(slots).reduce((total, [slot, clarity]) => total + clarity * (weights[slot] ?? 0), 0);
  const score = 1 - weightedClarity;
  const openQuestions = input.questions.filter((question) => question.status === "unanswered").map((question) => question.question);
  const assumptionsUsed = input.questions.filter((question) => question.status === "assumed").map((question) => question.question);
  const blockingQuestions = input.questions.filter((question) => question.blocking && question.status === "unanswered").map((question) => question.question);

  return {
    threshold,
    score: Number(score.toFixed(3)),
    slots,
    slotStatus: buildSlotStatus(input.questions),
    openQuestions,
    assumptionsUsed,
    blockingQuestions,
    passed: score <= threshold && blockingQuestions.length === 0,
  };
}

function scoreSlots(questions: QuestionRecord[], weights: Record<string, number>): Record<string, number> {
  const slots: Record<string, number> = {};
  for (const slot of Object.keys(weights)) {
    const slotQuestions = questions.filter((question) => question.slot === slot);
    const best = slotQuestions.length === 0 ? 0 : Math.max(...slotQuestions.map((question) => statusScore(question.status)));
    slots[slot] = Number(best.toFixed(3));
  }
  return slots;
}

function buildSlotStatus(questions: QuestionRecord[]): Record<string, QuestionRecord["status"]> {
  const statusBySlot = new Map<string, QuestionRecord["status"]>();
  const precedence: QuestionRecord["status"][] = ["unanswered", "assumed", "answered", "verified"];

  for (const question of questions) {
    if (!question.slot) {
      continue;
    }
    const current = statusBySlot.get(question.slot);
    const next = question.status ?? "unanswered";
    if (!current || precedence.indexOf(next) > precedence.indexOf(current)) {
      statusBySlot.set(question.slot, next);
    }
  }

  return Object.fromEntries(statusBySlot.entries());
}

function statusScore(status: QuestionRecord["status"]): number {
  switch (status) {
    case "verified":
      return 1;
    case "answered":
      return 0.85;
    case "assumed":
      return 0.6;
    case "unanswered":
    default:
      return 0;
  }
}
