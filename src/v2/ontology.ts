import type { DocumentSet } from "../shared/types.js";
import type { ExecutionModelPolicy, OntologyNode, OntologySeed } from "./types.js";

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
