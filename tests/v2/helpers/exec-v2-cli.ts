import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectRoot } from "../../helpers/project-root.js";

const execFileAsync = promisify(execFile);

export async function execV2Cli(args: string[], options?: { env?: NodeJS.ProcessEnv }) {
  const result = await execFileAsync("node", [
    "--import",
    "tsx",
    "src/cli/index.ts",
    ...args,
  ], {
    cwd: projectRoot,
    env: options?.env,
  });

  return JSON.parse(result.stdout);
}
