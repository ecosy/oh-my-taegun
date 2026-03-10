#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const repoRoot = readArg("-C") ?? process.cwd();
const outputPath = readArg("-o");
const mode = process.env.OMT_FAKE_CODEX_MODE ?? "changed";
const targetFile = process.env.OMT_FAKE_CODEX_TARGET_FILE ?? "README.md";
const targetContent = process.env.OMT_FAKE_CODEX_TARGET_CONTENT ?? "# implemented\n";
const wrongContent = process.env.OMT_FAKE_CODEX_WRONG_CONTENT ?? "broken\n";

if (!outputPath) {
  console.error("missing -o output path");
  process.exit(2);
}

const prompt = await readStdin();
const statePath = join(repoRoot, ".fake-codex-state.json");
const state = await readState(statePath);
state.attempt += 1;
await writeState(statePath, state);

let changedFiles = [];
let status = "changed";

switch (mode) {
  case "changed":
    changedFiles = [await writeTarget(repoRoot, targetFile, targetContent)];
    break;
  case "repair-on-second":
    changedFiles = [await writeTarget(repoRoot, targetFile, state.attempt === 1 ? wrongContent : targetContent)];
    break;
  case "no-change":
    status = "no_change";
    break;
  case "blocked":
    status = "blocked";
    break;
  case "invalid-json":
    await writeFile(outputPath, "not json");
    emitEvent(state.attempt);
    process.exit(0);
  case "out-of-scope":
    changedFiles = [];
    for (let index = 0; index < 25; index += 1) {
      changedFiles.push(await writeTarget(repoRoot, `generated/file-${index}.txt`, `file ${index}\n`));
    }
    break;
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({
  status,
  summary: `mode=${mode}; prompt_length=${prompt.length}`,
  changed_files: changedFiles,
  suggested_validation_commands: [],
  unresolved_items: status === "blocked" ? ["blocked by fake codex"] : [],
  evidence_refs: ["fake-codex"],
}, null, 2));

emitEvent(state.attempt);
process.exit(Number(process.env.OMT_FAKE_CODEX_EXIT_CODE ?? "0"));

function readArg(flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return { attempt: 0 };
  }
}

async function writeState(path, payload) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(payload, null, 2));
}

async function writeTarget(root, relativePath, content) {
  const absolutePath = join(root, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
  return relativePath;
}

function emitEvent(attempt) {
  process.stdout.write(JSON.stringify({
    type: "session.started",
    session_id: `fake-session-${attempt}`,
  }) + "\n");
}
