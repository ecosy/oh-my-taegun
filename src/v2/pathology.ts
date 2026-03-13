import type { PathologySignal } from "./types.js";

export function detectPathologySignals(summaries: string[]): PathologySignal[] {
  const unique = new Set(summaries);
  const repetitive = summaries.length > 1 && unique.size < summaries.length;
  const oscillation = summaries.length >= 4 && summaries[0] === summaries[2] && summaries[1] === summaries[3];
  const stagnation = summaries.length >= 3 && unique.size === 1;

  return [
    {
      type: "stagnation",
      detected: stagnation,
      evidence: stagnation ? [...unique] : [],
    },
    {
      type: "oscillation",
      detected: oscillation,
      evidence: oscillation ? summaries.slice(0, 4) : [],
    },
    {
      type: "repetitive_feedback",
      detected: repetitive,
      evidence: repetitive ? summaries : [],
    },
  ];
}
