import type { CapabilityReport } from "../shared/types.js";

export function evaluateRegressionValidation(capabilities: CapabilityReport): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  if (capabilities.testCommands.length === 0) {
    issues.push("No regression-capable test command was detected.");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
