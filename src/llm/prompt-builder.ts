import type { DocumentSet, Requirement } from "../shared/types.js";
import type { WorkUnit, WorkUnitContext } from "./types.js";

export function buildWorkUnitPrompt(
  documents: DocumentSet,
  unit: WorkUnit,
  context: WorkUnitContext,
): string {
  const requirements = documents.requirements.requirements.filter((requirement) =>
    unit.requirementIds.includes(requirement.id),
  );
  const acceptance = documents.acceptance.acceptance_criteria.filter((criterion) =>
    unit.acceptanceIds.includes(criterion.id),
  );
  const testPlan = documents.testPlan.test_plan.filter((item) =>
    unit.testPlanIds.includes(item.id),
  );

  return [
    "# Work Unit",
    "",
    `- work_unit_id: ${unit.id}`,
    `- run_id: ${unit.runId}`,
    `- iteration: ${unit.iteration}`,
    `- objective: ${unit.objective}`,
    `- edit_mode: ${unit.editMode}`,
    `- execution_scope: ${unit.executionScope}`,
    "",
    "## Requirements",
    "",
    ...requirements.flatMap(renderRequirement),
    "",
    "## Acceptance Criteria",
    "",
    ...acceptance.flatMap((criterion) => [
      `- ${criterion.id}: ${criterion.title}`,
      `  - description: ${criterion.description}`,
    ]),
    "",
    "## Test Plan",
    "",
    ...testPlan.flatMap((item) => [
      `- ${item.id}: ${item.description}`,
      `  - stage: ${item.stage}`,
      `  - method: ${item.method}`,
    ]),
    "",
    "## Repository Capabilities",
    "",
    `- runtime: ${context.capabilities.runtime ?? "unknown"}`,
    `- package_manager: ${context.capabilities.packageManager ?? "unknown"}`,
    `- test_commands: ${context.capabilities.testCommands.join(", ") || "none"}`,
    `- typecheck_commands: ${context.capabilities.typecheckCommands.join(", ") || "none"}`,
    `- build_commands: ${context.capabilities.buildCommands.join(", ") || "none"}`,
    "",
    "## Allowed Validation Commands",
    "",
    ...unit.validationCommands.map((command) => `- ${command}`),
    "",
    "## Constraints",
    "",
    ...unit.constraints.map((constraint) => `- ${constraint}`),
    "- Do not push changes.",
    "- Do not create or update PRs.",
    "- Do not deploy or perform external writes.",
    "- Do not add or rotate secrets.",
    "- Do not edit unrelated files unless required to satisfy the selected requirement step.",
    "- Prefer the smallest diff that satisfies the requirement step.",
    "",
    "## Prior Attempt Context",
    "",
    `- prior_summary: ${context.summaryOfPriorAttempts ?? "none"}`,
    `- failure_evidence: ${context.failureEvidence?.join(" | ") ?? "none"}`,
    `- changed_files_so_far: ${context.changedFilesSoFar?.join(", ") ?? "none"}`,
    "",
    "## Required Final Response JSON",
    "",
    "```json",
    "{",
    '  "status": "changed | no_change | blocked | failed",',
    '  "summary": "string",',
    '  "changed_files": ["string"],',
    '  "suggested_validation_commands": ["string"],',
    '  "unresolved_items": ["string"],',
    '  "evidence_refs": ["string"]',
    "}",
    "```",
  ].join("\n");
}

function renderRequirement(requirement: Requirement): string[] {
  return [
    `- ${requirement.id} [${requirement.priority}] ${requirement.title}`,
    `  - description: ${requirement.description}`,
  ];
}
