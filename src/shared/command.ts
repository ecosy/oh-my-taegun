import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export async function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd, env });
  return {
    stdout: stdout.toString().trim(),
    stderr: stderr.toString().trim(),
  };
}

export async function runShellCommand(command: string, cwd?: string, env?: NodeJS.ProcessEnv): Promise<CommandResult> {
  const { stdout, stderr } = await execFileAsync("sh", ["-lc", command], { cwd, env });
  return {
    stdout: stdout.toString().trim(),
    stderr: stderr.toString().trim(),
  };
}
