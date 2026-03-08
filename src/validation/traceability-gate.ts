import type { DocumentSet } from "../shared/types.js";

export interface TraceabilityResult {
  passed: boolean;
  issues: string[];
  mustRequirementCount: number;
  acceptanceCount: number;
  testPlanCount: number;
}

export function evaluateTraceability(documents: DocumentSet): TraceabilityResult {
  const issues: string[] = [];
  const mustRequirements = documents.requirements.requirements.filter((requirement) => requirement.priority === "MUST");
  const acceptanceByRequirement = new Map<string, string[]>();
  const testPlanByAcceptance = new Map<string, string[]>();
  const contractTypes = new Set(documents.taskContracts.task_contracts.map((contract) => contract.type));

  for (const acceptance of documents.acceptance.acceptance_criteria) {
    for (const requirementId of acceptance.requirement_ids) {
      const current = acceptanceByRequirement.get(requirementId) ?? [];
      current.push(acceptance.id);
      acceptanceByRequirement.set(requirementId, current);
    }
  }

  for (const item of documents.testPlan.test_plan) {
    for (const acceptanceId of item.acceptance_ids) {
      const current = testPlanByAcceptance.get(acceptanceId) ?? [];
      current.push(item.id);
      testPlanByAcceptance.set(acceptanceId, current);
    }
  }

  for (const requirement of mustRequirements) {
    if (!acceptanceByRequirement.get(requirement.id)?.length) {
      issues.push(`MUST requirement ${requirement.id} is not linked to any acceptance criterion.`);
    }
  }

  for (const acceptance of documents.acceptance.acceptance_criteria) {
    if (!testPlanByAcceptance.get(acceptance.id)?.length) {
      issues.push(`Acceptance criterion ${acceptance.id} is not linked to any test plan item.`);
    }
  }

  for (const task of documents.profile.tasks) {
    if (!contractTypes.has(task.type)) {
      issues.push(`Task type ${task.type} is missing from task-contracts.yaml.`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    mustRequirementCount: mustRequirements.length,
    acceptanceCount: documents.acceptance.acceptance_criteria.length,
    testPlanCount: documents.testPlan.test_plan.length,
  };
}
