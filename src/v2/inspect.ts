import { readFile, stat } from "node:fs/promises";
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
  const repoEvidence = await collectRepoEvidence(workspace);

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
      reasons: withFallback(compact([
        verifiedBuildCommands.length > 0 ? "Build commands are backed by package.json scripts." : undefined,
        verifiedTestCommands.length > 0 ? "Test commands are backed by package.json scripts." : undefined,
        verifiedLintCommands.length > 0 ? "Lint commands are backed by package.json scripts." : undefined,
        verifiedTypecheckCommands.length > 0 ? "Typecheck commands are backed by package.json scripts." : undefined,
      ]), "No verified capability evidence was recorded for command-backed checks."),
    },
    unverified: {
      buildCommands: capabilities.buildCommands.filter((command) => !verifiedBuildCommands.includes(command)),
      testCommands: capabilities.testCommands.filter((command) => !verifiedTestCommands.includes(command)),
      lintCommands: capabilities.lintCommands.filter((command) => !verifiedLintCommands.includes(command)),
      typecheckCommands: capabilities.typecheckCommands.filter((command) => !verifiedTypecheckCommands.includes(command)),
      deploymentTargets: [],
      secretRequirements: [],
      externalWriteSurfaces: [...capabilities.externalWriteSurfaces],
      reasons: withFallback(compact([
        capabilities.buildCommands.some((command) => !verifiedBuildCommands.includes(command))
          ? "Some build commands were inferred but do not map to package.json scripts." : undefined,
        capabilities.testCommands.some((command) => !verifiedTestCommands.includes(command))
          ? "Some test commands were inferred but do not map to package.json scripts." : undefined,
        capabilities.lintCommands.some((command) => !verifiedLintCommands.includes(command))
          ? "Some lint commands were inferred but do not map to package.json scripts." : undefined,
        capabilities.typecheckCommands.some((command) => !verifiedTypecheckCommands.includes(command))
          ? "Some typecheck commands were inferred but do not map to package.json scripts." : undefined,
        capabilities.externalWriteSurfaces.length > 0
          ? "External write surfaces were detected but not verified for autonomous execution." : undefined,
      ]), "No unverified command evidence was detected."),
    },
    notes: [...capabilities.notes],
    evidenceRefs: compact([
      "pwd",
      packageJson ? "package.json" : undefined,
      capabilities.secretRequirements[0],
      ...repoEvidence,
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

async function collectRepoEvidence(workspace: string): Promise<string[]> {
  const evidence: string[] = [];
  const files = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".gitlab-ci.yml",
    "circle.yml",
    ".env.example",
    ".env.template",
    ".env.sample",
    "tsconfig.json",
    "jsconfig.json",
    "vitest.config.ts",
    "vitest.config.js",
    "jest.config.js",
    "jest.config.ts",
  ];

  for (const file of files) {
    if (await exists(join(workspace, file))) {
      evidence.push(file);
    }
  }

  if (await exists(join(workspace, ".github", "workflows"))) {
    evidence.push(".github/workflows");
  }

  return evidence;
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true).catch(() => false);
}

function compact(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function withFallback(values: string[], fallback: string): string[] {
  return values.length > 0 ? values : [fallback];
}
