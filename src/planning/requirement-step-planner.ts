import type { CapabilityReport, DocumentSet, Requirement } from "../shared/types.js";
import type { RequirementStepPlan, WorkUnit } from "../llm/types.js";
import { resolveLlmRuntimeSettings } from "../llm/types.js";

export interface RequirementStepPlannerOptions {
  runId: string;
  repoRoot: string;
  capabilities: CapabilityReport;
  includeShouldRequirements?: boolean;
}

export function planRequirementSteps(
  documents: DocumentSet,
  options: RequirementStepPlannerOptions,
): RequirementStepPlan {
  const settings = resolveLlmRuntimeSettings(documents.profile.llm_execution);
  const includeShouldRequirements = options.includeShouldRequirements ?? settings.includeShouldRequirements;
  const eligibleRequirements = documents.requirements.requirements.filter((requirement) =>
    requirement.priority === "MUST" || (includeShouldRequirements && requirement.priority === "SHOULD"),
  );

  const grouped = new Map<string, Requirement[]>();
  for (const requirement of eligibleRequirements.sort(compareRequirements)) {
    const acceptanceIds = documents.acceptance.acceptance_criteria
      .filter((criterion) => criterion.requirement_ids.includes(requirement.id))
      .map((criterion) => criterion.id)
      .sort();
    const key = acceptanceIds.join("|") || requirement.id;
    const current = grouped.get(key) ?? [];
    current.push(requirement);
    grouped.set(key, current);
  }

  const workUnits: WorkUnit[] = [];
  let iteration = 1;
  for (const group of [...grouped.values()].sort((left, right) => compareRequirements(left[0], right[0]))) {
    const requirementIds = group.map((requirement) => requirement.id).sort();
    const acceptanceIds = documents.acceptance.acceptance_criteria
      .filter((criterion) => criterion.requirement_ids.some((requirementId) => requirementIds.includes(requirementId)))
      .map((criterion) => criterion.id)
      .sort();
    const testPlanIds = documents.testPlan.test_plan
      .filter((item) => item.acceptance_ids.some((acceptanceId) => acceptanceIds.includes(acceptanceId)))
      .map((item) => item.id)
      .sort();

    const primary = group[0];
    workUnits.push({
      id: `wu-${String(iteration).padStart(3, "0")}`,
      runId: options.runId,
      iteration,
      requirementIds,
      acceptanceIds,
      testPlanIds,
      title: primary.title,
      objective: group.length === 1
        ? `${primary.id}를 만족하도록 구현한다.`
        : `${requirementIds.join(", ")}를 함께 만족하도록 구현한다.`,
      repoRoot: options.repoRoot,
      validationCommands: selectValidationCommands(options.capabilities),
      constraints: [
        `Only satisfy ${requirementIds.join(", ")} in this work unit.`,
        `Acceptance criteria in scope: ${acceptanceIds.join(", ") || "none"}.`,
        `Test-plan evidence in scope: ${testPlanIds.join(", ") || "none"}.`,
      ],
      editMode: "direct-edit",
      executionScope: "code-and-test",
      model: settings.model,
      maxAttempts: settings.perUnitMaxAttempts,
    });
    iteration += 1;
  }

  return {
    workUnits,
    selectedRequirementIds: eligibleRequirements.map((requirement) => requirement.id),
  };
}

function selectValidationCommands(capabilities: CapabilityReport): string[] {
  const commands = [
    ...capabilities.typecheckCommands,
    ...capabilities.testCommands.slice(0, 1),
    ...capabilities.buildCommands.slice(0, 1),
  ].filter(Boolean);
  return [...new Set(commands)];
}

function compareRequirements(left: Requirement, right: Requirement): number {
  const priorityRank = priorityWeight(left.priority) - priorityWeight(right.priority);
  if (priorityRank !== 0) {
    return priorityRank;
  }
  return left.id.localeCompare(right.id);
}

function priorityWeight(priority: Requirement["priority"]): number {
  switch (priority) {
    case "MUST":
      return 0;
    case "SHOULD":
      return 1;
    case "COULD":
      return 2;
  }
}
