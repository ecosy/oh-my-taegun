import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { projectRoot } from "./project-root.js";

export async function createFakeCodexEnv(extraEnv?: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
  const binDir = await mkdtemp(join(tmpdir(), "omt-codex-bin-"));
  const wrapperPath = join(binDir, "codex");
  const fixturePath = join(projectRoot, "tests", "fixtures", "fake-codex-cli.mjs");
  const script = `#!/bin/sh\nnode "${fixturePath}" "$@"\n`;

  await writeFile(wrapperPath, script);
  await chmod(wrapperPath, 0o755);

  return {
    ...process.env,
    ...extraEnv,
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
  };
}
