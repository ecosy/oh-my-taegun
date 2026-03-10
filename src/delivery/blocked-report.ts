import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BlockedReason, RunState } from "../shared/types.js";

function blockedReportPath(workspace: string, runId: string): string {
  return join(workspace, ".omt", "reports", `blocked-${runId}.md`);
}

export async function writeBlockedReport(
  workspace: string,
  runState: RunState,
  reasons: BlockedReason[],
): Promise<string> {
  const path = blockedReportPath(workspace, runState.run_id);
  await mkdir(dirname(path), { recursive: true });

  const content = `# Blocked Report

## reason

${reasons.map((reason) => `- ${reason.code}: ${reason.message}`).join("\n")}

## evidence

${reasons.flatMap((reason) => reason.evidence ?? []).map((evidence) => `- ${evidence}`).join("\n") || "- none"}

## local_state_summary

- run_id: ${runState.run_id}
- status: ${runState.status}
- current_task: ${runState.current_task}
- feature_branch: ${runState.delivery.feature_branch}
- target_branch: ${runState.delivery.target_branch}
- remote_pushed: ${runState.delivery.remote_pushed ?? false}
- pr_url: ${runState.delivery.pr_url ?? "none"}

## next_action

${reasons.map((reason) => `- ${reason.requiredAction ?? "Investigate and retry."}`).join("\n")}

## retry_command

- npm run run -- --repo-path ${workspace}

## credential_or_policy_gap

${reasons
  .filter((reason) => reason.code.includes("delivery") || reason.code.includes("policy") || reason.code.includes("origin"))
  .map((reason) => `- ${reason.message}`)
  .join("\n") || "- none"}
`;

  await writeFile(path, content);
  return path;
}
