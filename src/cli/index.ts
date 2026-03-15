#!/usr/bin/env node
import { cwd } from "node:process";
import { CliError } from "../shared/errors.js";
import { error } from "../shared/logger.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runDesignCommand } from "./commands/design.js";
import { runInspectCommand } from "./commands/inspect.js";
import { runRunCommand } from "./commands/run.js";
import { runResumeCommand } from "./commands/resume.js";
import { runReportCommand } from "./commands/report.js";
import { runWatchCommand } from "./commands/watch.js";

type CommandName = "doctor" | "inspect" | "design" | "run" | "resume" | "report" | "watch";

async function main(): Promise<void> {
  const [commandName, ...rest] = process.argv.slice(2);
  const command = commandName as CommandName | undefined;
  const args = parseArgs(rest);
  const projectRoot = args["project-root"] ?? cwd();

  switch (command) {
    case "doctor":
      await runDoctorCommand(projectRoot, args);
      break;
    case "inspect":
      await runInspectCommand(projectRoot, args);
      break;
    case "design":
      await runDesignCommand(projectRoot, args);
      break;
    case "run":
      await runRunCommand(projectRoot, args);
      break;
    case "resume":
      await runResumeCommand(projectRoot, args);
      break;
    case "report":
      await runReportCommand(projectRoot, args);
      break;
    case "watch":
      await runWatchCommand(projectRoot, args);
      break;
    default:
      throw new CliError("Usage: omt <doctor|inspect|design|run|resume|report|watch> [--key value]");
  }
}

function parseArgs(tokens: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

main().catch((cause) => {
  const failure = cause instanceof CliError ? cause : new CliError(cause instanceof Error ? cause.message : String(cause));
  error(failure.message);
  process.exitCode = failure.exitCode;
});
