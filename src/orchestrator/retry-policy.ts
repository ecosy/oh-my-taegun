export interface RetryDirectiveInput {
  attempt: number;
  maxAttempts: number;
  status: "changed" | "no_change" | "blocked" | "failed";
  validationPassed: boolean;
}

export interface RetryDirective {
  action: "complete" | "retry" | "blocked";
  nextAttempt?: number;
}

export function decideRetryDirective(input: RetryDirectiveInput): RetryDirective {
  if (input.status === "blocked") {
    return { action: "blocked" };
  }

  if (input.validationPassed && (input.status === "changed" || input.status === "no_change")) {
    return { action: "complete" };
  }

  if (input.attempt >= input.maxAttempts) {
    return { action: "blocked" };
  }

  return {
    action: "retry",
    nextAttempt: input.attempt + 1,
  };
}
