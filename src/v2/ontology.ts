import type { BlockedReason, DocumentSet } from "../shared/types.js";
import type { ConvergenceSnapshot, ExecutionModelPolicy, OntologyNode, OntologySeed } from "./types.js";

export function buildOntologySeed(documents: DocumentSet, policy: ExecutionModelPolicy): OntologySeed {
  const nodes: OntologyNode[] = [
    ...documents.requirements.requirements.map((requirement) => ({
      name: requirement.id,
      kind: "requirement" as const,
      refs: requirement.source_refs,
    })),
    ...documents.acceptance.acceptance_criteria.map((acceptance) => ({
      name: acceptance.id,
      kind: "acceptance" as const,
      refs: acceptance.requirement_ids,
    })),
    {
      name: policy.workUnitBudgetProfile,
      kind: "policy" as const,
      refs: policy.approvedModels,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    designSummary: `Requirements=${documents.requirements.requirements.length}; Acceptance=${documents.acceptance.acceptance_criteria.length}; ApprovedModels=${policy.approvedModels.join(",") || "none"}`,
  };
}

export function calculateOntologySimilarity(previous: OntologySeed, current: OntologySeed): number {
  const previousNames = new Set(previous.nodes.map((node) => `${node.kind}:${node.name}`));
  const currentNames = new Set(current.nodes.map((node) => `${node.kind}:${node.name}`));
  const union = new Set([...previousNames, ...currentNames]);
  const overlap = [...previousNames].filter((name) => currentNames.has(name));
  return union.size === 0 ? 1 : Number((overlap.length / union.size).toFixed(3));
}

export function buildConvergenceSnapshot(input: {
  designSeed: OntologySeed;
  targetRequirementIds?: string[];
  targetAcceptanceIds?: string[];
  completedRequirementIds: string[];
  coveredAcceptanceIds: string[];
  executionModelPolicy: ExecutionModelPolicy;
  changedFiles: string[];
  blockedReasons?: BlockedReason[];
  threshold?: number;
}): ConvergenceSnapshot {
  const threshold = input.threshold ?? 0.95;
  const targetRequirementIds = input.targetRequirementIds ?? input.designSeed.nodes
    .filter((node) => node.kind === "requirement")
    .map((node) => node.name);
  const targetAcceptanceIds = input.targetAcceptanceIds ?? input.designSeed.nodes
    .filter((node) => node.kind === "acceptance")
    .map((node) => node.name);
  const comparisonSeed: OntologySeed = {
    generatedAt: input.designSeed.generatedAt,
    nodes: input.designSeed.nodes.filter((node) => {
      if (node.kind === "requirement") {
        return targetRequirementIds.includes(node.name);
      }
      if (node.kind === "acceptance") {
        return targetAcceptanceIds.includes(node.name);
      }
      return node.kind === "policy";
    }),
    designSummary: input.designSeed.designSummary,
  };
  const currentSeed: OntologySeed = {
    generatedAt: new Date().toISOString(),
    nodes: [
      ...input.completedRequirementIds.map((id) => ({ name: id, kind: "requirement" as const, refs: [] })),
      ...input.coveredAcceptanceIds.map((id) => ({ name: id, kind: "acceptance" as const, refs: [] })),
      {
        name: input.executionModelPolicy.workUnitBudgetProfile,
        kind: "policy" as const,
        refs: input.executionModelPolicy.approvedModels,
      },
    ],
    designSummary: `CompletedRequirements=${input.completedRequirementIds.length}; CoveredAcceptance=${input.coveredAcceptanceIds.length}`,
  };

  const similarity = calculateOntologySimilarity(comparisonSeed, currentSeed);
  const expectedRequirements = new Set(
    targetRequirementIds,
  );
  const expectedAcceptance = new Set(
    targetAcceptanceIds,
  );
  const missingRequirements = [...expectedRequirements].filter((id) => !input.completedRequirementIds.includes(id));
  const missingAcceptance = [...expectedAcceptance].filter((id) => !input.coveredAcceptanceIds.includes(id));
  const designPolicy = input.designSeed.nodes.find((node) => node.kind === "policy");
  const policyShift = designPolicy
    ? designPolicy.name !== input.executionModelPolicy.workUnitBudgetProfile
      || [...designPolicy.refs].sort().join(",") !== [...input.executionModelPolicy.approvedModels].sort().join(",")
    : false;
  const unexplainedNewScope = (input.blockedReasons ?? []).some((reason) => reason.code === "out_of_scope_edit")
    || (input.changedFiles.length > 0 && input.completedRequirementIds.length === 0);
  const driftCategories: ConvergenceSnapshot["driftCategories"] = [];

  if (missingRequirements.length > 0) {
    driftCategories.push("missing_requirement");
  }
  if (missingAcceptance.length > 0) {
    driftCategories.push("missing_acceptance");
  }
  if (policyShift) {
    driftCategories.push("policy_shift");
  }
  if (unexplainedNewScope) {
    driftCategories.push("unexplained_new_scope");
  }

  const missingCoverage = [...missingRequirements, ...missingAcceptance];
  const ontologyDriftDetected = driftCategories.length > 0 || similarity < threshold;

  return {
    generatedAt: new Date().toISOString(),
    similarity,
    threshold,
    converged: !ontologyDriftDetected && similarity >= threshold,
    ontologyDriftDetected,
    driftCategories,
    missingCoverage,
    replanSuggested: ontologyDriftDetected,
  };
}
