import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { CapabilityReport } from "../shared/types.js";

export async function detectCapabilities(workspace: string): Promise<CapabilityReport> {
  const packageJsonPath = join(workspace, "package.json");
  const packageJson = await readJson(packageJsonPath);
  const hasPackageJson = !!packageJson;

  const packageManager = await detectPackageManager(workspace, packageJson);
  const scripts = typeof packageJson?.scripts === "object" && packageJson.scripts
    ? (packageJson.scripts as Record<string, string>)
    : {};

  const buildCommands = collectScriptCommands(scripts, ["build"], packageManager);
  const testCommands = collectScriptCommands(scripts, ["test", "test:unit", "test:integration", "test:e2e"], packageManager);
  const lintCommands = collectScriptCommands(scripts, ["lint"], packageManager);
  const typecheckCommands = collectScriptCommands(scripts, ["check", "typecheck"], packageManager);
  const deploymentTargets = collectDeploymentTargets(scripts, packageManager);
  const secretRequirements = await detectSecretRequirements(workspace);

  const languages = hasPackageJson ? ["TypeScript/JavaScript"] : [];
  const runtime = hasPackageJson ? "Node.js" : null;
  const notes: string[] = [];

  let classification: CapabilityReport["classification"] = "blocked";
  if (hasPackageJson && packageManager) {
    classification = "supported";
  } else if (hasPackageJson) {
    classification = "partial";
    notes.push("Package manager was not detected from lock files.");
  } else {
    notes.push("package.json was not found.");
  }

  if (deploymentTargets.length === 0) {
    notes.push("Deployment command was not detected.");
  }

  return {
    classification,
    languages,
    runtime,
    packageManager,
    buildCommands,
    testCommands,
    lintCommands,
    typecheckCommands,
    deploymentTargets,
    secretRequirements,
    externalWriteSurfaces: [],
    notes,
  };
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true).catch(() => false);
}

async function detectPackageManager(
  workspace: string,
  packageJson: Record<string, unknown> | null,
): Promise<string | null> {
  if (await exists(join(workspace, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (await exists(join(workspace, "package-lock.json"))) {
    return "npm";
  }
  if (await exists(join(workspace, "yarn.lock"))) {
    return "yarn";
  }
  const packageManager = packageJson?.packageManager;
  return typeof packageManager === "string" ? packageManager.split("@")[0] : null;
}

function collectScriptCommands(
  scripts: Record<string, string>,
  names: string[],
  packageManager: string | null,
): string[] {
  return names.flatMap((name) => (scripts[name] ? [scriptInvocation(name, packageManager)] : []));
}

function collectDeploymentTargets(scripts: Record<string, string>, packageManager: string | null): string[] {
  return Object.entries(scripts)
    .filter(([key]) => key.includes("deploy"))
    .map(([key]) => scriptInvocation(key, packageManager));
}

function scriptInvocation(scriptName: string, packageManager: string | null): string {
  switch (packageManager) {
    case "pnpm":
      return `pnpm run ${scriptName}`;
    case "yarn":
      return `yarn ${scriptName}`;
    case "npm":
    default:
      return `npm run ${scriptName}`;
  }
}

async function detectSecretRequirements(workspace: string): Promise<string[]> {
  const files = [".env.example", ".env.template", ".env.sample"];
  const matches: string[] = [];
  for (const file of files) {
    if (await exists(join(workspace, file))) {
      matches.push(file);
    }
  }
  return matches;
}
