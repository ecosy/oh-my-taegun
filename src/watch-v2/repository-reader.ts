import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { discoverRun } from "./discovery.js";
import type { ReplayHint, RequirementWatchStatus, WatchPhase, WatchSnapshot } from "./types.js";
import { v2EventLogPath, v2ReportPath, v2Root, v2SeedPath, v2SnapshotDir } from "../v2/files.js";
import type { EventRecord, ExecutionModelPolicy, V2RunState } from "../v2/types.js";

interface RequirementDocument {
  requirements?: Array<{
    id?: string;
    title?: string;
  }>;
}

interface EvalSummaryDocument {
  levels?: Array<{
    level_id?: string;
    requirement_id?: string;
    passed?: boolean;
  }>;
}

interface ReplaySummaryDocument {
  levels?: Array<{
    level_id?: string;
    title?: string;
    seed?: number;
    command?: string;
  }>;
}

interface SnapshotDocument {
  changedFiles?: string[];
}

interface ReportDocument {
  executionModelPolicy?: ExecutionModelPolicy;
  validationSummary?: {
    featureValidation?: { passed?: boolean };
    regressionValidation?: { passed?: boolean };
  };
  deliveryStatus?: {
    status?: string;
    deliveryReadiness?: string;
    currentStage?: string;
    completedStages?: string[];
  };
}

interface DesignSeedDocument {
  executionModelPolicy?: ExecutionModelPolicy;
}

interface WorkUnitPayload {
  workUnitId?: string;
  requirementIds?: string[];
  acceptanceIds?: string[];
  attempt?: number;
  changedFiles?: string[];
}

export async function readWatchSnapshot(repoPath: string, requestedRunId?: string): Promise<WatchSnapshot> {
  const warnings: string[] = [];
  const exists = await stat(repoPath).then(() => true).catch(() => false);
  if (!exists) {
    return idleSnapshot(repoPath, [`Repository path does not exist: ${repoPath}.`]);
  }

  const runSelection = await discoverRun(repoPath, requestedRunId);
  warnings.push(...runSelection.warnings);

  const requirementDocument = await readYamlDocument<RequirementDocument>(join(repoPath, "docs", "v2", "requirements.yaml"), warnings);
  const requirements = (requirementDocument?.requirements ?? [])
    .filter((entry): entry is { id: string; title: string } => Boolean(entry?.id) && Boolean(entry?.title))
    .map((entry) => ({ requirementId: entry.id, title: entry.title }));
  const requirementStatuses = new Map<string, RequirementWatchStatus>(
    requirements.map((entry) => [entry.requirementId, "pending"]),
  );

  const designSeedPath = await existingPath(v2SeedPath(repoPath));
  const runId = runSelection.runId;
  const eventLogPath = runId ? await existingPath(v2EventLogPath(repoPath, runId)) : null;
  const eventLog = eventLogPath ? await readEventLog(eventLogPath, warnings) : [];
  const runState = runId ? await readJsonDocument<V2RunState>(join(v2Root(repoPath), "state", "runs", `${runId}.json`), warnings) : null;
  const reportPath = runId ? await existingPath(v2ReportPath(repoPath, runId)) : null;
  const report = reportPath ? await readJsonDocument<ReportDocument>(reportPath, warnings) : null;
  const designSeed = designSeedPath ? await readJsonDocument<DesignSeedDocument>(designSeedPath, warnings) : null;
  const evalSummaryPath = await existingPath(join(repoPath, "artifacts", "eval", "summary.json"));
  const evalSummary = evalSummaryPath ? await readJsonDocument<EvalSummaryDocument>(evalSummaryPath, warnings) : null;
  const replaySummaryPath = await existingPath(join(repoPath, "artifacts", "replay", "latest.json"));
  const replaySummary = replaySummaryPath ? await readJsonDocument<ReplaySummaryDocument>(replaySummaryPath, warnings) : null;

  const workUnitEvents = deriveWorkUnitState(eventLog);
  applyRequirementStatuses({
    requirementStatuses,
    activeRequirementIds: workUnitEvents.activeRequirementIds,
    changedRequirementIds: workUnitEvents.changedRequirementIds,
    blockedRequirementIds: workUnitEvents.blockedRequirementIds,
    validatedRequirementIds: extractValidatedRequirementIds(evalSummary),
  });

  const snapshotChangedFiles = runId ? await readLatestSnapshotChangedFiles(repoPath, runId, warnings) : [];
  const changedFiles = snapshotChangedFiles.length > 0
    ? snapshotChangedFiles
    : Array.from(new Set(workUnitEvents.changedFiles));

  const currentWorkUnit = workUnitEvents.currentWorkUnit;
  const modelPolicy = selectModelPolicy(
    runState?.executionModelPolicy ?? report?.executionModelPolicy ?? designSeed?.executionModelPolicy ?? null,
  );
  const phase = resolvePhase(runState, eventLog);
  const replayHints = buildReplayHints(replaySummary, replaySummaryPath);

  return {
    repoPath,
    runId,
    phase,
    currentStage: runState?.deliveryStatus.currentStage ?? report?.deliveryStatus?.currentStage ?? null,
    completedStages: runState?.deliveryStatus.completedStages ?? report?.deliveryStatus?.completedStages ?? [],
    modelPolicy,
    currentWorkUnit,
    requirementStatuses: requirements.map((entry) => ({
      requirementId: entry.requirementId,
      title: entry.title,
      status: requirementStatuses.get(entry.requirementId) ?? "pending",
    })),
    latestEvents: eventLog.slice(-20).map((event) => ({
      timestamp: event.timestamp,
      phase: event.phase,
      type: event.type,
      payload: event.payload,
    })),
    changedFiles,
    validation: {
      featurePassed: runState?.validationSummary.featureValidation.passed ?? report?.validationSummary?.featureValidation?.passed ?? null,
      regressionPassed: runState?.validationSummary.regressionValidation.passed ?? report?.validationSummary?.regressionValidation?.passed ?? null,
      deliveryStatus: runState?.deliveryStatus.status ?? report?.deliveryStatus?.status ?? null,
      deliveryReadiness: runState?.deliveryStatus.deliveryReadiness ?? report?.deliveryStatus?.deliveryReadiness ?? null,
    },
    replayHints,
    artifactPaths: {
      designSeed: designSeedPath,
      eventLog: eventLogPath,
      report: reportPath,
      evalSummary: evalSummaryPath,
      replaySummary: replaySummaryPath,
    },
    warnings,
  };
}

function idleSnapshot(repoPath: string, warnings: string[]): WatchSnapshot {
  return {
    repoPath,
    runId: null,
    phase: "idle",
    currentStage: null,
    completedStages: [],
    modelPolicy: null,
    currentWorkUnit: null,
    requirementStatuses: [],
    latestEvents: [],
    changedFiles: [],
    validation: {
      featurePassed: null,
      regressionPassed: null,
      deliveryStatus: null,
      deliveryReadiness: null,
    },
    replayHints: [],
    artifactPaths: {
      designSeed: null,
      eventLog: null,
      report: null,
      evalSummary: null,
      replaySummary: null,
    },
    warnings,
  };
}

async function readEventLog(path: string, warnings: string[]): Promise<EventRecord[]> {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as EventRecord);
  } catch (error) {
    warnings.push(`Failed to read event log: ${path}.`);
    return [];
  }
}

async function readLatestSnapshotChangedFiles(repoPath: string, runId: string, warnings: string[]): Promise<string[]> {
  const snapshotDirectory = v2SnapshotDir(repoPath, runId);
  const files = await readdir(snapshotDirectory).catch(() => []);
  const ranked = files
    .map((file) => {
      const match = /^snapshot-(\d+)\.json$/u.exec(file);
      return match ? { file, iteration: Number.parseInt(match[1] ?? "0", 10) } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => right.iteration - left.iteration);
  if (ranked.length === 0) {
    return [];
  }
  const snapshot = await readJsonDocument<SnapshotDocument>(join(snapshotDirectory, ranked[0].file), warnings);
  return snapshot?.changedFiles?.filter((file): file is string => typeof file === "string") ?? [];
}

function deriveWorkUnitState(events: EventRecord[]): {
  currentWorkUnit: WatchSnapshot["currentWorkUnit"];
  activeRequirementIds: Set<string>;
  changedRequirementIds: Set<string>;
  blockedRequirementIds: Set<string>;
  changedFiles: string[];
} {
  const planned = new Map<string, WorkUnitPayload>();
  const startedAttempts = new Map<string, number | null>();
  const activeRequirementIds = new Set<string>();
  const changedRequirementIds = new Set<string>();
  const blockedRequirementIds = new Set<string>();
  const changedFiles: string[] = [];
  let currentWorkUnit: WatchSnapshot["currentWorkUnit"] = null;

  for (const event of events) {
    const payload = event.payload as WorkUnitPayload;
    if (event.type === "work_unit_planned") {
      planned.set(payload.workUnitId ?? "", payload);
      for (const requirementId of payload.requirementIds ?? []) {
        activeRequirementIds.add(requirementId);
      }
      currentWorkUnit = toCurrentWorkUnit(payload, startedAttempts.get(payload.workUnitId ?? "") ?? null);
    }
    if (event.type === "work_unit_started") {
      if (payload.workUnitId) {
        startedAttempts.set(payload.workUnitId, typeof payload.attempt === "number" ? payload.attempt : null);
      }
      const plannedPayload = payload.workUnitId ? planned.get(payload.workUnitId) : undefined;
      currentWorkUnit = toCurrentWorkUnit(plannedPayload ?? payload, typeof payload.attempt === "number" ? payload.attempt : null);
    }
    if (event.type === "work_unit_completed") {
      for (const requirementId of payload.requirementIds ?? planned.get(payload.workUnitId ?? "")?.requirementIds ?? []) {
        activeRequirementIds.add(requirementId);
        changedRequirementIds.add(requirementId);
      }
      for (const file of payload.changedFiles ?? []) {
        if (typeof file === "string") {
          changedFiles.push(file);
        }
      }
      const plannedPayload = payload.workUnitId ? planned.get(payload.workUnitId) : undefined;
      currentWorkUnit = toCurrentWorkUnit(
        plannedPayload ?? payload,
        typeof payload.attempt === "number" ? payload.attempt : startedAttempts.get(payload.workUnitId ?? "") ?? null,
      );
    }
    if (event.type === "blocked_raised" && currentWorkUnit) {
      for (const requirementId of currentWorkUnit.requirementIds) {
        blockedRequirementIds.add(requirementId);
      }
    }
  }

  return {
    currentWorkUnit,
    activeRequirementIds,
    changedRequirementIds,
    blockedRequirementIds,
    changedFiles,
  };
}

function toCurrentWorkUnit(payload: WorkUnitPayload | undefined, attempt: number | null): WatchSnapshot["currentWorkUnit"] {
  if (!payload?.workUnitId) {
    return null;
  }
  return {
    workUnitId: payload.workUnitId,
    requirementIds: payload.requirementIds ?? [],
    acceptanceIds: payload.acceptanceIds ?? [],
    attempt,
  };
}

function applyRequirementStatuses(input: {
  requirementStatuses: Map<string, RequirementWatchStatus>;
  activeRequirementIds: Set<string>;
  changedRequirementIds: Set<string>;
  blockedRequirementIds: Set<string>;
  validatedRequirementIds: Set<string>;
}): void {
  for (const requirementId of input.activeRequirementIds) {
    input.requirementStatuses.set(requirementId, "active");
  }
  for (const requirementId of input.changedRequirementIds) {
    input.requirementStatuses.set(requirementId, "changed");
  }
  for (const requirementId of input.validatedRequirementIds) {
    input.requirementStatuses.set(requirementId, "validated");
  }
  for (const requirementId of input.blockedRequirementIds) {
    input.requirementStatuses.set(requirementId, "blocked");
  }
}

function extractValidatedRequirementIds(summary: EvalSummaryDocument | null): Set<string> {
  return new Set(
    (summary?.levels ?? [])
      .filter((level) => level.passed && typeof level.requirement_id === "string")
      .map((level) => level.requirement_id as string),
  );
}

function buildReplayHints(summary: ReplaySummaryDocument | null, artifactPath: string | null): ReplayHint[] {
  return (summary?.levels ?? [])
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry?.level_id) && Boolean(entry?.title) && Boolean(entry?.command))
    .map((entry) => ({
      levelId: entry.level_id ?? "unknown",
      title: entry.title ?? "Untitled replay",
      seed: typeof entry.seed === "number" ? entry.seed : null,
      command: entry.command ?? "",
      artifactPath,
    }));
}

function resolvePhase(runState: V2RunState | null, events: EventRecord[]): WatchPhase {
  if (runState?.status === "blocked") {
    return "blocked";
  }
  if (runState) {
    return normalizePhase(runState.phase);
  }
  const lastEvent = events.at(-1);
  if (!lastEvent) {
    return "idle";
  }
  return lastEvent.type === "blocked_raised" ? "blocked" : normalizePhase(lastEvent.phase);
}

function toModelPolicy(policy: ExecutionModelPolicy): WatchSnapshot["modelPolicy"] {
  return {
    surveyedModels: policy.surveyedModels,
    approvedModels: policy.approvedModels,
    defaultDesignModel: policy.defaultDesignModel ?? null,
    defaultExecutionModel: policy.defaultExecutionModel ?? null,
    defaultVerifierModel: policy.defaultVerifierModel ?? null,
    workUnitBudgetProfile: policy.workUnitBudgetProfile ?? null,
  };
}

function selectModelPolicy(policy: ExecutionModelPolicy | null): WatchSnapshot["modelPolicy"] {
  if (!policy) {
    return null;
  }
  return toModelPolicy(policy);
}

function normalizePhase(phase: string): WatchPhase {
  if (phase === "doctor") {
    return "design";
  }
  if (
    phase === "design"
    || phase === "plan"
    || phase === "execute"
    || phase === "verify"
    || phase === "review"
    || phase === "deliver"
  ) {
    return phase;
  }
  return "idle";
}

async function existingPath(path: string): Promise<string | null> {
  return stat(path).then(() => path).catch(() => null);
}

async function readJsonDocument<T>(path: string, warnings: string[]): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    warnings.push(`Failed to read JSON artifact: ${path}.`);
    return null;
  }
}

async function readYamlDocument<T>(path: string, warnings: string[]): Promise<T | null> {
  try {
    return YAML.parse(await readFile(path, "utf8")) as T;
  } catch {
    warnings.push(`Failed to read YAML artifact: ${path}.`);
    return null;
  }
}
