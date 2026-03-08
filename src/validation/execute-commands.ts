import { runShellCommand } from "../shared/command.js";
import type { ValidationExecutionResult } from "../shared/types.js";

export async function executeCommands(commands: string[], cwd: string): Promise<ValidationExecutionResult> {
  const outputs: ValidationExecutionResult["outputs"] = [];
  const issues: string[] = [];

  for (const command of commands) {
    try {
      const result = await runShellCommand(command, cwd);
      outputs.push({
        command,
        passed: true,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (cause) {
      const stdout = cause instanceof Error && "stdout" in cause ? String((cause as { stdout?: string }).stdout ?? "") : "";
      const stderr = cause instanceof Error && "stderr" in cause ? String((cause as { stderr?: string }).stderr ?? "") : "";
      outputs.push({
        command,
        passed: false,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
      issues.push(`Command failed: ${command}`);
    }
  }

  return {
    passed: issues.length === 0,
    commands,
    outputs,
    issues,
  };
}
