import { readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { v2EventLogPath, v2Root } from "../v2/files.js";

export interface RunSelection {
  requestedRunId: string | null;
  runId: string | null;
  eventLogPath: string | null;
  warnings: string[];
}

export async function discoverRun(repoPath: string, requestedRunId?: string): Promise<RunSelection> {
  const warnings: string[] = [];
  if (requestedRunId) {
    const eventLogPath = v2EventLogPath(repoPath, requestedRunId);
    const exists = await stat(eventLogPath).then(() => true).catch(() => false);
    if (!exists) {
      warnings.push(`Requested run ${requestedRunId} was not found under ${join(v2Root(repoPath), "events")}.`);
      return {
        requestedRunId,
        runId: requestedRunId,
        eventLogPath: null,
        warnings,
      };
    }
    return {
      requestedRunId,
      runId: requestedRunId,
      eventLogPath,
      warnings,
    };
  }

  const eventsDir = join(v2Root(repoPath), "events");
  const files = await readdir(eventsDir).catch(() => []);
  const candidates = (
    await Promise.all(
      files
        .filter((file) => file.endsWith(".jsonl"))
        .map(async (file) => {
          const fullPath = join(eventsDir, file);
          const details = await stat(fullPath).catch(() => null);
          if (!details) {
            return null;
          }
          return {
            runId: basename(file, ".jsonl"),
            eventLogPath: fullPath,
            mtimeMs: details.mtimeMs,
          };
        }),
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (candidates.length === 0) {
    warnings.push(`No run detected under ${eventsDir}.`);
    return {
      requestedRunId: null,
      runId: null,
      eventLogPath: null,
      warnings,
    };
  }

  candidates.sort((left, right) => {
    if (right.mtimeMs !== left.mtimeMs) {
      return right.mtimeMs - left.mtimeMs;
    }
    return right.runId.localeCompare(left.runId);
  });

  return {
    requestedRunId: null,
    runId: candidates[0].runId,
    eventLogPath: candidates[0].eventLogPath,
    warnings,
  };
}
