import { runShellCommand } from "../shared/command.js";
import type { DeliveryTargetStage, StageRunnerKind, V2RunState } from "./types.js";

export interface StageCommandExecutionInput {
  stage: DeliveryTargetStage;
  runnerKind: StageRunnerKind;
  command: string;
  validationCommand?: string;
  workspace: string;
  env?: NodeJS.ProcessEnv;
}

export async function executeStageCommand(
  input: StageCommandExecutionInput,
): Promise<V2RunState["deliveryStatus"]["stageResults"][number]> {
  const startedAt = Date.now();
  const commandResult = await runAndCapture(input.command, input.workspace, input.env);
  if (!commandResult.success || !input.validationCommand) {
    return {
      stage: input.stage,
      status: commandResult.success ? "completed" : "blocked",
      command: input.command,
      runnerKind: input.runnerKind,
      stdout: commandResult.stdout,
      stderr: commandResult.stderr,
      exitCode: commandResult.exitCode,
      durationMs: Date.now() - startedAt,
      cwd: input.workspace,
      evidenceRefs: [input.command],
      nextActions: commandResult.success
        ? []
        : [`Inspect ${input.stage} command output and retry the stage.`],
    };
  }

  const validationResult = await runAndCapture(input.validationCommand, input.workspace, input.env);
  return {
    stage: input.stage,
    status: commandResult.success && validationResult.success ? "completed" : "blocked",
    command: input.command,
    validationCommand: input.validationCommand,
    runnerKind: input.runnerKind,
    stdout: [commandResult.stdout, validationResult.stdout].filter(Boolean).join("\n"),
    stderr: [commandResult.stderr, validationResult.stderr].filter(Boolean).join("\n"),
    exitCode: validationResult.exitCode,
    durationMs: Date.now() - startedAt,
    cwd: input.workspace,
    evidenceRefs: [input.command, input.validationCommand],
    nextActions: validationResult.success
      ? []
      : [`Inspect ${input.stage} validation output and retry the stage.`],
  };
}

async function runAndCapture(command: string, cwd: string, env?: NodeJS.ProcessEnv): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  try {
    const result = await runShellCommand(command, cwd, env);
    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (cause) {
    return {
      success: false,
      stdout: "",
      stderr: cause instanceof Error ? cause.message : String(cause),
      exitCode: 1,
    };
  }
}
