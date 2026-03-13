import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createFakeCodexEnv } from "../helpers/fake-codex.js";
import { createTempProjectDocs } from "../helpers/temp-project.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";
import { projectRoot } from "../helpers/project-root.js";

const execFileAsync = promisify(execFile);

describe("example feature addition", () => {
  it("adds a small feature across code and test files", async () => {
    const repo = await createTempGitRepo({
      scripts: {
        test: "node validate.js",
        build: "node -e \"process.exit(0)\"",
      },
      files: {
        "src/names.js": "export function formatName(first, last) { return `${first} ${last}`; }\n",
        "tests/names.test.js": "import { formatName } from '../src/names.js';\nif (formatName('Ada', 'Lovelace') !== 'Ada Lovelace') process.exit(1);\n",
        "validate.js": `
import { readFileSync } from "node:fs";
import { formatDisplayName } from "./src/names.js";
const testFile = readFileSync(new URL("./tests/names.test.js", import.meta.url), "utf8");
if (formatDisplayName({ name: "Ada" }) !== "Ada") process.exit(1);
if (formatDisplayName({}) !== "Guest") process.exit(1);
if (!testFile.includes("Guest")) process.exit(1);
`,
      },
    });
    const project = await createTempProjectDocs({
      profileId: "fixture-feature-addition",
      requirements: [
        {
          id: "REQ-FEATURE-001",
          priority: "MUST",
          title: "Add formatDisplayName()",
          description: "Introduce a null-safe formatDisplayName() helper and cover the Guest fallback in tests.",
          source_refs: ["fixture-feature"],
        },
      ],
      acceptance: [
        {
          id: "AC-FEATURE-001",
          requirement_ids: ["REQ-FEATURE-001"],
          title: "New helper and tests exist",
          description: "The helper returns the correct display name and tests mention the Guest fallback.",
          verification: { automated: { commands: ["npm test"] } },
        },
      ],
      testPlan: [
        {
          id: "TP-FEATURE-001",
          acceptance_ids: ["AC-FEATURE-001"],
          category: "integration",
          method: "automated",
          stage: "nightly",
          description: "Run the helper validation script.",
        },
      ],
    });
    const env = await createFakeCodexEnv({
      OMT_FAKE_CODEX_MODE: "changed",
      OMT_FAKE_CODEX_WRITES: JSON.stringify([
        {
          path: "src/names.js",
          content: "export function formatName(first, last) { return `${first} ${last}`; }\nexport function formatDisplayName(user) { return user?.name ?? 'Guest'; }\n",
        },
        {
          path: "tests/names.test.js",
          content: "import { formatName, formatDisplayName } from '../src/names.js';\nif (formatName('Ada', 'Lovelace') !== 'Ada Lovelace') process.exit(1);\nif (formatDisplayName({ name: 'Ada' }) !== 'Ada') process.exit(1);\nif (formatDisplayName({}) !== 'Guest') process.exit(1);\n",
        },
      ]),
      OMT_CODEX_MODEL: "gpt-5.4",
    });

    const result = await execFileAsync("node", [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "run",
      "--project-root",
      project,
      "--repo-path",
      repo,
    ], { cwd: projectRoot, env });

    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe("completed");

    const source = await readFile(`${repo}/src/names.js`, "utf8");
    const testFile = await readFile(`${repo}/tests/names.test.js`, "utf8");
    expect(source).toContain("formatDisplayName");
    expect(testFile).toContain("Guest");
  }, 15000);
});
