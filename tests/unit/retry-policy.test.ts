import { describe, expect, it } from "vitest";
import { decideRetryDirective } from "../../src/orchestrator/retry-policy.js";

describe("retry policy", () => {
  it("retries failed validation before exhausting max attempts", () => {
    expect(decideRetryDirective({
      attempt: 1,
      maxAttempts: 3,
      status: "changed",
      validationPassed: false,
    })).toEqual({
      action: "retry",
      nextAttempt: 2,
    });
  });

  it("blocks when max attempts are exhausted", () => {
    expect(decideRetryDirective({
      attempt: 3,
      maxAttempts: 3,
      status: "failed",
      validationPassed: false,
    })).toEqual({
      action: "blocked",
    });
  });
});
