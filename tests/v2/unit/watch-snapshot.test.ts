import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { readWatchSnapshot } from "../../../src/watch-v2/repository-reader.js";

describe("watch snapshot", () => {
  it("derives requirement state from events, reports, evaluation, and replay metadata", async () => {
    const repo = await createFixtureRepo();
    const snapshot = await readWatchSnapshot(repo);

    expect(snapshot.runId).toBe("20260314121212001");
    expect(snapshot.phase).toBe("blocked");
    expect(snapshot.currentWorkUnit).toEqual({
      workUnitId: "wu-002",
      requirementIds: ["REQ-HWY-201"],
      acceptanceIds: ["AC-HWY-201"],
      attempt: 1,
    });
    expect(snapshot.requirementStatuses).toEqual([
      {
        requirementId: "REQ-HWY-101",
        title: "Conservative longitudinal control on easy highway",
        status: "validated",
      },
      {
        requirementId: "REQ-HWY-201",
        title: "Safe lane-change selection on dense traffic",
        status: "blocked",
      },
      {
        requirementId: "REQ-HWY-301",
        title: "Replay metadata and manual review flow",
        status: "pending",
      },
    ]);
    expect(snapshot.changedFiles).toEqual([
      "src/omt_highway/agent.py",
      "src/omt_highway/policy_utils.py",
    ]);
    expect(snapshot.validation).toEqual({
      featurePassed: true,
      regressionPassed: false,
      deliveryStatus: "blocked",
      deliveryReadiness: "blocked-on-validation",
    });
    expect(snapshot.replayHints).toHaveLength(1);
    expect(snapshot.replayHints[0]).toMatchObject({
      levelId: "level-01",
      seed: 11,
      command: "npm run demo -- --level level-01 --seed 11",
    });
    expect(snapshot.artifactPaths.eventLog).toContain("/.omt/v2/events/20260314121212001.jsonl");
    expect(snapshot.warnings).toEqual([]);
  });

  it("stays null-safe when no run has been created yet", async () => {
    const repo = await createTempGitRepo({
      files: {
        "docs/v2/requirements.yaml": [
          "requirements:",
          "  - id: REQ-HWY-101",
          "    title: Conservative longitudinal control on easy highway",
        ].join("\n"),
        ".omt/v2/design/seed.json": JSON.stringify({
          executionModelPolicy: {
            surveyedModels: ["gpt-5.4"],
            approvedModels: ["gpt-5.4"],
            defaultDesignModel: "gpt-5.4",
            defaultExecutionModel: "gpt-5.4",
            defaultVerifierModel: "gpt-5.4",
            workUnitBudgetProfile: "low_capability",
          },
        }, null, 2),
      },
    });

    const snapshot = await readWatchSnapshot(repo);

    expect(snapshot.runId).toBeNull();
    expect(snapshot.phase).toBe("idle");
    expect(snapshot.modelPolicy?.defaultExecutionModel).toBe("gpt-5.4");
    expect(snapshot.requirementStatuses).toEqual([
      {
        requirementId: "REQ-HWY-101",
        title: "Conservative longitudinal control on easy highway",
        status: "pending",
      },
    ]);
    expect(snapshot.validation.featurePassed).toBeNull();
    expect(snapshot.warnings[0]).toContain("No run detected");
  });
});

async function createFixtureRepo(): Promise<string> {
  const repo = await createTempGitRepo({
    files: {
      "docs/v2/requirements.yaml": [
        "requirements:",
        "  - id: REQ-HWY-101",
        "    title: Conservative longitudinal control on easy highway",
        "  - id: REQ-HWY-201",
        "    title: Safe lane-change selection on dense traffic",
        "  - id: REQ-HWY-301",
        "    title: Replay metadata and manual review flow",
      ].join("\n"),
      ".omt/v2/design/seed.json": JSON.stringify({
        executionModelPolicy: {
          surveyedModels: ["gpt-5.2-codex"],
          approvedModels: ["gpt-5.4"],
          defaultDesignModel: "gpt-5.2-codex",
          defaultExecutionModel: "gpt-5.2-codex",
          defaultVerifierModel: "gpt-5.4",
          workUnitBudgetProfile: "low_capability",
        },
      }, null, 2),
      ".omt/v2/events/20260314121212001.jsonl": [
        JSON.stringify({
          runId: "20260314121212001",
          phase: "plan",
          type: "work_unit_planned",
          timestamp: "2026-03-14T12:12:12.100Z",
          payload: {
            workUnitId: "wu-001",
            requirementIds: ["REQ-HWY-101"],
            acceptanceIds: ["AC-HWY-101"],
          },
        }),
        JSON.stringify({
          runId: "20260314121212001",
          phase: "execute",
          type: "work_unit_started",
          timestamp: "2026-03-14T12:12:12.200Z",
          payload: {
            workUnitId: "wu-001",
            attempt: 1,
          },
        }),
        JSON.stringify({
          runId: "20260314121212001",
          phase: "execute",
          type: "work_unit_completed",
          timestamp: "2026-03-14T12:12:12.300Z",
          payload: {
            workUnitId: "wu-001",
            attempt: 1,
            requirementIds: ["REQ-HWY-101"],
            acceptanceIds: ["AC-HWY-101"],
            changedFiles: ["src/omt_highway/agent.py"],
          },
        }),
        JSON.stringify({
          runId: "20260314121212001",
          phase: "plan",
          type: "work_unit_planned",
          timestamp: "2026-03-14T12:12:12.400Z",
          payload: {
            workUnitId: "wu-002",
            requirementIds: ["REQ-HWY-201"],
            acceptanceIds: ["AC-HWY-201"],
          },
        }),
        JSON.stringify({
          runId: "20260314121212001",
          phase: "execute",
          type: "work_unit_started",
          timestamp: "2026-03-14T12:12:12.500Z",
          payload: {
            workUnitId: "wu-002",
            attempt: 1,
          },
        }),
        JSON.stringify({
          runId: "20260314121212001",
          phase: "verify",
          type: "blocked_raised",
          timestamp: "2026-03-14T12:12:12.600Z",
          payload: {
            message: "validation blocked",
          },
        }),
      ].join("\n") + "\n",
      ".omt/v2/reports/20260314121212001.json": JSON.stringify({
        runId: "20260314121212001",
        validationSummary: {
          featureValidation: { passed: true },
          regressionValidation: { passed: false },
        },
        deliveryStatus: {
          status: "blocked",
          deliveryReadiness: "blocked-on-validation",
          currentStage: "dry-run",
          completedStages: [],
        },
      }, null, 2),
      ".omt/v2/snapshots/20260314121212001/snapshot-2.json": JSON.stringify({
        changedFiles: ["src/omt_highway/agent.py", "src/omt_highway/policy_utils.py"],
      }, null, 2),
      "artifacts/eval/summary.json": JSON.stringify({
        suite_id: "omt-highway-staged",
        levels: [
          {
            level_id: "level-01",
            requirement_id: "REQ-HWY-101",
            passed: true,
          },
          {
            level_id: "level-02",
            requirement_id: "REQ-HWY-201",
            passed: false,
          },
        ],
      }, null, 2),
      "artifacts/replay/latest.json": JSON.stringify({
        suite_id: "omt-highway-staged",
        generated_at: "2026-03-14T12:12:13.000Z",
        levels: [
          {
            level_id: "level-01",
            title: "Conservative longitudinal control on easy highway",
            passed: true,
            seed: 11,
            max_steps: 35,
            command: "npm run demo -- --level level-01 --seed 11",
          },
        ],
      }, null, 2),
    },
  });
  await mkdir(join(repo, ".omt", "v2", "state", "runs"), { recursive: true });
  await writeFile(join(repo, ".omt", "v2", "state", "runs", "20260314121212001.json"), JSON.stringify({
    runId: "20260314121212001",
    status: "blocked",
    phase: "verify",
    validationSummary: {
      featureValidation: { passed: true },
      regressionValidation: { passed: false },
    },
    deliveryStatus: {
      status: "blocked",
      deliveryReadiness: "blocked-on-validation",
      currentStage: "dry-run",
      completedStages: [],
    },
    executionModelPolicy: {
      surveyedModels: ["gpt-5.2-codex"],
      approvedModels: ["gpt-5.4"],
      defaultDesignModel: "gpt-5.2-codex",
      defaultExecutionModel: "gpt-5.2-codex",
      defaultVerifierModel: "gpt-5.4",
      workUnitBudgetProfile: "low_capability",
    },
  }, null, 2));
  return repo;
}
