import { describe, expect, it } from "vitest";
import { loadV2Yaml } from "../helpers/load-v2-doc.js";

describe("v2 policy no unverified capability execution", () => {
  it("blocks execution when required capability is unverified", async () => {
    const contracts = await loadV2Yaml<Record<string, any>>("docs/v2/task-contracts.yaml");
    const task = (contracts.task_contracts as Array<Record<string, any>>).find((entry) => entry.type === "execute_work_units");
    expect(task?.blocked_when).toContain("required_capability_unverified");
  });
});
