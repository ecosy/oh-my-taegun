import { describe, expect, it } from "vitest";
import { createTask } from "../../src/orchestrator/task-dispatcher.js";

describe("task dispatcher", () => {
  it("creates known task implementations", () => {
    expect(createTask("repo-intake").id).toBe("repo-intake");
    expect(createTask("deliver").id).toBe("deliver");
    expect(createTask("summarize-outcome").id).toBe("summarize-outcome");
  });
});
