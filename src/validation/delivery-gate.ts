import type { CapabilityReport, DeliveryMode } from "../shared/types.js";

export interface DeliveryGateInput {
  deliveryMode: DeliveryMode;
  originUrl?: string;
  targetBranch: string;
  featureValidationPassed: boolean;
  regressionValidationPassed: boolean;
  capabilities: CapabilityReport;
}

export function evaluateDeliveryGate(input: DeliveryGateInput): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (input.deliveryMode === "dry-run") {
    return {
      passed: true,
      issues,
    };
  }

  if (!input.featureValidationPassed) {
    issues.push("Feature validation did not pass.");
  }
  if (!input.regressionValidationPassed) {
    issues.push("Regression validation did not pass.");
  }
  if (!input.originUrl) {
    issues.push("Repository origin URL is not configured.");
  }
  if (!input.targetBranch) {
    issues.push("Target branch is missing.");
  }
  if (isGitHubOrigin(input.originUrl) && !hasGitHubToken()) {
    issues.push("GitHub token is not configured for PR delivery.");
  }
  if (input.capabilities.classification === "blocked") {
    issues.push("Capabilities are blocked, so delivery cannot proceed.");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function isGitHubOrigin(originUrl?: string): boolean {
  return Boolean(originUrl?.includes("github.com"));
}

function hasGitHubToken(): boolean {
  return Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
}
