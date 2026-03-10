import { describe, expect, it } from "vitest";
import { parseWorkUnitResultMessage } from "../../src/llm/result-schema.js";

describe("result schema", () => {
  it("parses a valid Codex final message", () => {
    const result = parseWorkUnitResultMessage(JSON.stringify({
      status: "changed",
      summary: "Implemented.",
      changed_files: ["README.md"],
      suggested_validation_commands: ["npm run test"],
      unresolved_items: [],
      evidence_refs: ["fake-codex"],
    }), {
      finalMessagePath: "/tmp/final.json",
      jsonEventLogPath: "/tmp/events.jsonl",
    });

    expect(result.status).toBe("changed");
    expect(result.changedFiles).toEqual(["README.md"]);
  });

  it("rejects malformed payloads", () => {
    expect(() => parseWorkUnitResultMessage("not json", {
      finalMessagePath: "/tmp/final.json",
      jsonEventLogPath: "/tmp/events.jsonl",
    })).toThrow();
  });
});
