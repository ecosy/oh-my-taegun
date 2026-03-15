import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "../../helpers/temp-repo.js";
import { projectRoot } from "../../helpers/project-root.js";

describe("v2 watch command", () => {
  it("serves the dashboard and latest-run snapshot", async () => {
    const repo = await createTempGitRepo({
      files: {
        "docs/v2/requirements.yaml": [
          "requirements:",
          "  - id: REQ-HWY-101",
          "    title: Conservative longitudinal control on easy highway",
        ].join("\n"),
        ".omt/v2/events/20260314151515001.jsonl": JSON.stringify({
          runId: "20260314151515001",
          phase: "plan",
          type: "work_unit_planned",
          timestamp: "2026-03-14T15:15:15.000Z",
          payload: {
            workUnitId: "wu-001",
            requirementIds: ["REQ-HWY-101"],
            acceptanceIds: ["AC-HWY-101"],
          },
        }) + "\n",
      },
    });
    const server = await startWatchProcess(repo);

    try {
      const root = await fetch(`${server.url}/`);
      const snapshotResponse = await fetch(`${server.url}/api/snapshot`);
      const snapshot = await snapshotResponse.json() as {
        runId: string | null;
        requirementStatuses: Array<{ requirementId: string; status: string }>;
      };

      expect(root.status).toBe(200);
      expect(await root.text()).toContain("OMT V2 Watch");
      expect(snapshot.runId).toBe("20260314151515001");
      expect(snapshot.requirementStatuses[0]).toEqual({
        requirementId: "REQ-HWY-101",
        title: "Conservative longitudinal control on easy highway",
        status: "active",
      });
    } finally {
      await stopWatchProcess(server.process);
    }
  }, 30000);

  it("returns warnings instead of crashing when .omt/v2 is missing", async () => {
    const repo = await createTempGitRepo();
    const server = await startWatchProcess(repo);

    try {
      const response = await fetch(`${server.url}/api/snapshot`);
      const snapshot = await response.json() as {
        phase: string;
        warnings: string[];
      };

      expect(response.status).toBe(200);
      expect(snapshot.phase).toBe("idle");
      expect(snapshot.warnings[0]).toContain("No run detected");
    } finally {
      await stopWatchProcess(server.process);
    }
  }, 30000);
});

async function startWatchProcess(repoPath: string): Promise<{ process: ReturnType<typeof spawn>; url: string }> {
  const child = spawn("node", [
    "--import",
    "tsx",
    "src/cli/index.ts",
    "watch",
    "--repo-path",
    repoPath,
    "--port",
    "0",
  ], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const url = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for watch server to start."));
    }, 10000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.once("data", (chunk: string) => {
      clearTimeout(timeout);
      resolve(chunk.trim());
    });
    child.stderr.once("data", (chunk: string) => {
      clearTimeout(timeout);
      reject(new Error(chunk.trim()));
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`watch exited before becoming ready: ${code ?? "unknown"}`));
    });
  });

  return { process: child, url };
}

async function stopWatchProcess(child: ReturnType<typeof spawn>): Promise<void> {
  child.kill("SIGTERM");
  await once(child, "exit");
}
