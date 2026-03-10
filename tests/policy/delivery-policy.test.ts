import { describe, expect, it } from "vitest";
import { evaluateDeliveryGate } from "../../src/validation/delivery-gate.js";

const supportedCapabilities = {
  classification: "supported" as const,
  languages: ["TypeScript/JavaScript"],
  runtime: "Node.js",
  packageManager: "npm",
  buildCommands: ["tsc -p tsconfig.json"],
  testCommands: ["vitest run"],
  lintCommands: [],
  typecheckCommands: [],
  deploymentTargets: [],
  secretRequirements: [],
  externalWriteSurfaces: [],
  notes: [],
};

describe("delivery policy", () => {
  it("blocks delivery when origin is missing", () => {
    const result = evaluateDeliveryGate({
      deliveryMode: "real-pr",
      originUrl: undefined,
      targetBranch: "develop",
      featureBranch: "feature/omt-1",
      featureValidationPassed: true,
      regressionValidationPassed: true,
      capabilities: supportedCapabilities,
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Repository origin URL is not configured.");
  });

  it("does not block dry-run delivery when remote configuration is absent", () => {
    const result = evaluateDeliveryGate({
      deliveryMode: "dry-run",
      originUrl: undefined,
      targetBranch: "develop",
      featureBranch: "feature/omt-1",
      featureValidationPassed: true,
      regressionValidationPassed: true,
      capabilities: supportedCapabilities,
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("blocks GitHub PR delivery when token is missing", () => {
    const result = evaluateDeliveryGate({
      deliveryMode: "real-pr",
      originUrl: "https://github.com/ecosy/oh-my-taegun.git",
      targetBranch: "develop",
      featureBranch: "feature/omt-1",
      featureValidationPassed: true,
      regressionValidationPassed: true,
      capabilities: supportedCapabilities,
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("GitHub token is not configured for PR delivery.");
  });
});
