import type { PathologySignal } from "./types.js";

export function detectPathologySignals(
  entries: string[] | Array<{ summary: string; hasNewEvidence?: boolean }>,
): PathologySignal[] {
  const normalized = entries.map((entry) => typeof entry === "string"
    ? { summary: entry, hasNewEvidence: true }
    : { summary: entry.summary, hasNewEvidence: entry.hasNewEvidence ?? true });
  const summaries = normalized.map((entry) => entry.summary);
  const unique = new Set(summaries);
  const repetitive = summaries.length > 1 && unique.size < summaries.length;
  const oscillation = summaries.length >= 4 && summaries[0] === summaries[2] && summaries[1] === summaries[3];
  const stagnation = summaries.length >= 3 && unique.size === 1;
  const noEvidenceSummaries = normalized.filter((entry) => !entry.hasNewEvidence).map((entry) => entry.summary);
  const retryWithoutNewEvidence = noEvidenceSummaries.length >= 2;

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
    {
      type: "retry_without_new_evidence",
      detected: retryWithoutNewEvidence,
      evidence: retryWithoutNewEvidence ? noEvidenceSummaries : [],
    },
  ];
}
