import { describe, expect, it } from "vitest";
import { calculateAmbiguityScore } from "../../../src/v2/metrics.js";

describe("v2 ambiguity score", () => {
  it("fails seed freeze when model policy or required slots are incomplete", () => {
    const scorecard = calculateAmbiguityScore({
      questions: [
        { id: "goal", question: "Goal is defined", required: true, source: "system", slot: "goal_clarity", status: "answered" },
        { id: "constraints", question: "Constraints are known", required: true, source: "doctor", slot: "constraint_clarity", status: "unanswered", blocking: true },
        { id: "success", question: "Success criteria are known", required: true, source: "system", slot: "success_criteria", status: "answered" },
        { id: "capability", question: "Verified test commands exist", required: true, source: "doctor", slot: "capability_clarity", status: "assumed" },
        {
          id: "policy",
          question: "Default execution model must be selected when multiple approved models exist.",
          required: true,
          source: "operator",
          slot: "model_policy_clarity",
          status: "unanswered",
          blocking: true,
        },
      ],
    });

    expect(scorecard.score).toBeGreaterThan(scorecard.threshold);
    expect(scorecard.passed).toBe(false);
    expect(scorecard.openQuestions).toContain("Default execution model must be selected when multiple approved models exist.");
    expect(scorecard.blockingQuestions).toContain("Default execution model must be selected when multiple approved models exist.");
  });
});
