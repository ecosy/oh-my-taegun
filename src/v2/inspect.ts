import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { detectCapabilities } from "../intake/detect-capabilities.js";
import type { CapabilityReport } from "../shared/types.js";
import type { VerifiedCapabilityReport } from "./types.js";

const INSPECT_ALLOWLIST = ["rg", "grep", "ls", "find", "wc", "cat", "head", "tail", "pwd", "printf"];

export async function inspectCapabilities(workspace: string): Promise<VerifiedCapabilityReport> {
  const capabilities = await detectCapabilities(workspace);
  const packageJsonPath = join(workspace, "package.json");
  const packageJson = await readJson(packageJsonPath);
  const scripts = typeof packageJson?.scripts === "object" && packageJson.scripts
    ? (packageJson.scripts as Record<string, unknown>)
    : {};

  const verifiedTestCommands = capabilities.testCommands.filter((command) => {
    const scriptName = scriptNameFromCommand(command);
    return Boolean(scriptName && typeof scripts[scriptName] === "string");
  });
  const verifiedBuildCommands = capabilities.buildCommands.filter((command) => {
    const scriptName = scriptNameFromCommand(command);
    return Boolean(scriptName && typeof scripts[scriptName] === "string");
  });
  const verifiedLintCommands = capabilities.lintCommands.filter((command) => {
    const scriptName = scriptNameFromCommand(command);
    return Boolean(scriptName && typeof scripts[scriptName] === "string");
  });
  const verifiedTypecheckCommands = capabilities.typecheckCommands.filter((command) => {
    const scriptName = scriptNameFromCommand(command);
    return Boolean(scriptName && typeof scripts[scriptName] === "string");
  });

  return {
    classification: capabilities.classification,
    runtime: capabilities.runtime,
    packageManager: capabilities.packageManager,
    languages: capabilities.languages,
    verified: {
      buildCommands: verifiedBuildCommands,
      testCommands: verifiedTestCommands,
      lintCommands: verifiedLintCommands,
      typecheckCommands: verifiedTypecheckCommands,
      deploymentTargets: [...capabilities.deploymentTargets],
      secretRequirements: [...capabilities.secretRequirements],
      externalWriteSurfaces: [],
    },
    unverified: {
      buildCommands: capabilities.buildCommands.filter((command) => !verifiedBuildCommands.includes(command)),
      testCommands: capabilities.testCommands.filter((command) => !verifiedTestCommands.includes(command)),
      lintCommands: capabilities.lintCommands.filter((command) => !verifiedLintCommands.includes(command)),
      typecheckCommands: capabilities.typecheckCommands.filter((command) => !verifiedTypecheckCommands.includes(command)),
      deploymentTargets: [],
      secretRequirements: [],
      externalWriteSurfaces: [...capabilities.externalWriteSurfaces],
    },
    notes: [...capabilities.notes],
    evidenceRefs: compact([
      "pwd",
      packageJson ? "package.json" : undefined,
      capabilities.secretRequirements[0],
    ]),
    allowlistUsed: [...INSPECT_ALLOWLIST],
  };
}

export function inspectAllowlist(): string[] {
  return [...INSPECT_ALLOWLIST];
}

export function toCapabilityReport(report: VerifiedCapabilityReport): CapabilityReport {
  return {
    classification: report.classification,
    languages: report.languages,
    runtime: report.runtime,
    packageManager: report.packageManager,
    buildCommands: [...report.verified.buildCommands],
    testCommands: [...report.verified.testCommands],
    lintCommands: [...report.verified.lintCommands],
    typecheckCommands: [...report.verified.typecheckCommands],
    deploymentTargets: [...report.verified.deploymentTargets],
    secretRequirements: [...report.verified.secretRequirements],
    externalWriteSurfaces: [...report.verified.externalWriteSurfaces],
    notes: [...report.notes],
  };
}

function scriptNameFromCommand(command: string): string | undefined {
  const parts = command.split(/\s+/u);
  return parts[parts.length - 1];
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function compact(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}
