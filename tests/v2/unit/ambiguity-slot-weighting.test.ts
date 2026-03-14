import { describe, expect, it } from "vitest";
import { calculateAmbiguityScore } from "../../../src/v2/metrics.js";

describe("v2 ambiguity slot weighting", () => {
  it("penalizes assumed answers more than explicit answers", () => {
    const assumed = calculateAmbiguityScore({
      questions: [
        { id: "goal", question: "goal", required: true, source: "system", slot: "goal_clarity", status: "answered" },
        { id: "constraints", question: "constraints", required: true, source: "doctor", slot: "constraint_clarity", status: "verified" },
        { id: "success", question: "success", required: true, source: "system", slot: "success_criteria", status: "answered" },
        { id: "capability", question: "capability", required: true, source: "doctor", slot: "capability_clarity", status: "verified" },
        { id: "policy", question: "policy", required: true, source: "operator", slot: "model_policy_clarity", status: "assumed" },
      ],
    });
    const answered = calculateAmbiguityScore({
      questions: [
        { id: "goal", question: "goal", required: true, source: "system", slot: "goal_clarity", status: "answered" },
        { id: "constraints", question: "constraints", required: true, source: "doctor", slot: "constraint_clarity", status: "verified" },
        { id: "success", question: "success", required: true, source: "system", slot: "success_criteria", status: "answered" },
        { id: "capability", question: "capability", required: true, source: "doctor", slot: "capability_clarity", status: "verified" },
        { id: "policy", question: "policy", required: true, source: "operator", slot: "model_policy_clarity", status: "answered" },
      ],
    });

    expect(assumed.score).toBeGreaterThan(answered.score);
    expect(assumed.assumptionsUsed).toContain("policy");
  });
});
