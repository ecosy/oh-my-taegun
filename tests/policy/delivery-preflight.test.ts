import { describe, expect, it } from "vitest";
import { evaluateDeliveryGate } from "../../src/validation/delivery-gate.js";

const supportedCapabilities = {
  classification: "supported" as const,
  languages: ["TypeScript/JavaScript"],
  runtime: "Node.js",
  packageManager: "npm",
  buildCommands: ["npm run build"],
  testCommands: ["npm run test"],
  lintCommands: [],
  typecheckCommands: ["npm run check"],
  deploymentTargets: [],
  secretRequirements: [],
  externalWriteSurfaces: [],
  notes: [],
};

describe("delivery preflight", () => {
  it("blocks non-policy feature branch names", () => {
    const result = evaluateDeliveryGate({
      deliveryMode: "real-pr",
      originUrl: "https://github.com/ecosy/oh-my-taegun.git",
      targetBranch: "develop",
      featureBranch: "hotfix/test",
      featureValidationPassed: true,
      regressionValidationPassed: true,
      capabilities: supportedCapabilities,
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Feature branch does not follow the feature/omt-* policy.");
  });
});
