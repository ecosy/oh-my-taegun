import type { CapabilityReport } from "../shared/types.js";

export function evaluateFeatureValidation(capabilities: CapabilityReport): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (capabilities.classification === "blocked") {
    issues.push("Capability detection marked the repository as blocked.");
  }

  if (capabilities.testCommands.length === 0) {
    issues.push("No feature validation command was detected.");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
