import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(workspaceRoot, "examples", "chat-mini-web", "fixture-template");
const remote = process.env.CHAT_DOGFOOD_REMOTE;
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const targetBranch = process.env.CHAT_DOGFOOD_TARGET_BRANCH ?? "develop";

if (!remote) {
  throw new Error("CHAT_DOGFOOD_REMOTE is required for PR smoke.");
}

if (!token) {
  throw new Error("GITHUB_TOKEN or GH_TOKEN is required for PR smoke.");
}

const tempWorkspace = await mkdtemp(join(tmpdir(), "chat-dogfood-pr-"));
const tempRepo = join(tempWorkspace, "examples", "chat-mini-web", "fixture-template");
await mkdir(join(tempWorkspace, "examples", "chat-mini-web"), { recursive: true });
await mkdir(join(tempWorkspace, "docs"), { recursive: true });
await cp(fixtureRoot, tempRepo, { recursive: true });
await cp(join(workspaceRoot, "docs", "state-schema.yaml"), join(tempWorkspace, "docs", "state-schema.yaml"));
await cp(join(workspaceRoot, "docs", "task-contracts.yaml"), join(tempWorkspace, "docs", "task-contracts.yaml"));
await cp(join(workspaceRoot, "docs", "test-matrix.yaml"), join(tempWorkspace, "docs", "test-matrix.yaml"));

const specPath = join(tempRepo, "docs", "spec.yaml");
const spec = await readFile(specPath, "utf8");
const patchedSpec = spec
  .replace("target_outcome: dry-run", "target_outcome: real-pr")
  .replace("target_branch: develop", `target_branch: ${targetBranch}`);
await writeFile(specPath, patchedSpec);

await execFileAsync("git", ["init"], { cwd: tempRepo });
await execFileAsync("git", ["config", "user.name", "Codex"], { cwd: tempRepo });
await execFileAsync("git", ["config", "user.email", "codex@example.com"], { cwd: tempRepo });
await execFileAsync("git", ["remote", "add", "origin", remote], { cwd: tempRepo });
await execFileAsync("git", ["add", "."], { cwd: tempRepo });
await execFileAsync("git", ["commit", "-m", "Seed chat dogfood fixture"], { cwd: tempRepo });

const env = {
  ...process.env,
  OMT_CODEX_MODEL: process.env.OMT_CODEX_MODEL ?? "gpt-5.4",
};

const result = await execFileAsync(
  "node",
  ["--import", "tsx", "src/cli/index.ts", "run", "--project-root", tempRepo, "--repo-path", tempRepo],
  { cwd: workspaceRoot, env },
);

let parsed;
try {
  parsed = JSON.parse(result.stdout);
} catch {
  parsed = { status: "unknown", raw_stdout: result.stdout };
}

const summary = {
  workspace_path: tempWorkspace,
  repo_path: tempRepo,
  project_root: tempRepo,
  remote,
  target_branch: targetBranch,
  model: env.OMT_CODEX_MODEL,
  run: parsed,
};

await writeFile(join(tempRepo, ".omt", "smoke-pr-summary.json"), JSON.stringify(summary, null, 2));
process.stdout.write(JSON.stringify(summary, null, 2));
