import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import type { WriteStream } from "node:tty";
import type { DocumentSet } from "../shared/types.js";
import type { DeliveryPolicyInput, InterviewAnswerFile, ModelPolicyInput } from "./types.js";
import type { DoctorResult } from "./types.js";
import { buildDeliveryPolicy, stageAtLeast } from "./delivery-policy.js";

export interface ResolvedDesignInterviewInput {
  modelPolicy: ModelPolicyInput;
  deliveryPolicy: DeliveryPolicyInput;
  interactive: boolean;
}

export async function resolveDesignInterviewInput(input: {
  args: Record<string, string>;
  documents: DocumentSet;
  doctor: DoctorResult;
}): Promise<ResolvedDesignInterviewInput> {
  const answersFile = input.args["answers-file"]
    ? await loadAnswersFile(input.args["answers-file"])
    : {};
  const legacyModelInput = legacyModelPolicyInput(input.args);
  const mergedModelPolicy = {
    ...answersFile.modelPolicy,
    ...definedEntries(legacyModelInput),
  };
  const mergedDeliveryPolicy = answersFile.deliveryPolicy ?? {};
  const hasLegacyNonInteractiveInput = Object.values(legacyModelInput).some(Boolean) || Boolean(input.args["answers-file"]);
  const interactiveRequested = input.args.interactive === "true";
  const nonInteractiveRequested = input.args["non-interactive"] === "true";
  const interactive = decideInteractiveMode({
    interactiveRequested,
    nonInteractiveRequested,
    hasLegacyNonInteractiveInput,
  });

  if (!interactive) {
    return {
      modelPolicy: mergedModelPolicy,
      deliveryPolicy: mergedDeliveryPolicy,
      interactive: false,
    };
  }

  if (!process.stdin.isTTY) {
    throw new Error("Interactive V2 design requires a TTY. Use --non-interactive --answers-file on non-interactive runners.");
  }

  return {
    modelPolicy: await promptForModelPolicy(input.documents, input.doctor, mergedModelPolicy),
    deliveryPolicy: await promptForDeliveryPolicy(input.documents, mergedDeliveryPolicy),
    interactive: true,
  };
}

function decideInteractiveMode(input: {
  interactiveRequested: boolean;
  nonInteractiveRequested: boolean;
  hasLegacyNonInteractiveInput: boolean;
}): boolean {
  if (input.nonInteractiveRequested) {
    return false;
  }
  if (input.interactiveRequested) {
    return true;
  }
  if (!process.stdin.isTTY && input.hasLegacyNonInteractiveInput) {
    return false;
  }
  return true;
}

async function promptForModelPolicy(
  documents: DocumentSet,
  doctor: DoctorResult,
  defaults: ModelPolicyInput,
): Promise<ModelPolicyInput> {
  const output = process.stderr as WriteStream;
  const rl = createInterface({
    input: process.stdin,
    output,
  });

  try {
    output.write(renderPreflightSummary(doctor));
    const repoConfirmation = await askWithDefault(rl, `Use repository path ${doctor.repository.localWorkspace}?`, "yes");
    if (!isAffirmative(repoConfirmation)) {
      throw new Error("Design interview aborted because repository confirmation was declined.");
    }

    const surveyedModels = await askWithDefault(rl, "Surveyed models (comma separated)", defaults.surveyModels ?? doctor.modelEnvironmentSurvey.surveyedModels.join(", "));
    const approvedModels = await askWithDefault(rl, "Approved models (comma separated)", defaults.approvedModels ?? doctor.modelEnvironmentSurvey.approvedModels.join(", "));
    const executionModel = await askWithDefault(rl, "Default execution model", defaults.executionModel ?? firstListEntry(approvedModels));
    const verifierModel = await askWithDefault(rl, "Default verifier model", defaults.verifierModel ?? executionModel);
    const designModel = await askWithDefault(rl, "Default design model", defaults.designModel ?? executionModel);
    const workUnitBudgetProfile = await askWithDefault(
      rl,
      "Work-unit budget profile",
      defaults.workUnitBudgetProfile ?? inferBudgetProfile(approvedModels),
    );
    const reasoningEfforts = await askWithDefault(rl, "Allowed reasoning efforts (comma separated)", defaults.reasoningEfforts ?? doctor.modelEnvironmentSurvey.reasoningEfforts.join(", "));
    const fallbackChain = await askWithDefault(rl, "Fallback models (comma separated or blank)", defaults.fallbackChain ?? "");

    return {
      surveyModels: surveyedModels,
      approvedModels,
      executionModel,
      verifierModel,
      designModel,
      workUnitBudgetProfile,
      reasoningEfforts,
      fallbackChain,
    };
  } finally {
    rl.close();
  }
}

async function promptForDeliveryPolicy(
  documents: DocumentSet,
  defaults: DeliveryPolicyInput,
): Promise<DeliveryPolicyInput> {
  const output = process.stderr as WriteStream;
  const rl = createInterface({
    input: process.stdin,
    output,
  });

  try {
    const baseline = buildDeliveryPolicy(documents, defaults);
    const targetStage = await askWithDefault(rl, "Target delivery stage (dry-run|commit|real-pr|dev|prod)", baseline.targetStage);
    const targetBranch = stageAtLeast(targetStage as typeof baseline.targetStage, "real-pr")
      ? await askWithDefault(rl, "PR target branch", baseline.realPr.targetBranch)
      : baseline.realPr.targetBranch;
    const featureBranchTemplate = stageAtLeast(targetStage as typeof baseline.targetStage, "real-pr")
      ? await askWithDefault(rl, "Feature branch template", baseline.realPr.featureBranchTemplate)
      : baseline.realPr.featureBranchTemplate;
    const titleTemplate = stageAtLeast(targetStage as typeof baseline.targetStage, "real-pr")
      ? await askWithDefault(rl, "PR title template", baseline.realPr.titleTemplate)
      : baseline.realPr.titleTemplate;
    const dev = stageAtLeast(targetStage as typeof baseline.targetStage, "dev")
      ? await promptForCommandPolicy(rl, "dev", defaults.dev)
      : undefined;
    const prod = targetStage === "prod"
      ? await promptForProdPolicy(rl, defaults.prod)
      : undefined;

    const summary = [
      "",
      "V2 design summary",
      `- target stage: ${targetStage}`,
      `- target branch: ${targetBranch}`,
      `- feature branch template: ${featureBranchTemplate}`,
      ...(dev ? [`- dev deploy: ${dev.command}`, `- dev validation: ${dev.validationCommand ?? "none"}`] : []),
      ...(prod ? [`- prod deploy: ${prod.command}`, `- prod validation: ${prod.validationCommand ?? "none"}`, `- prod approved: ${prod.approvedForThisRun ? "yes" : "no"}`] : []),
      "",
    ].join("\n");
    output.write(`${summary}\n`);
    const confirmed = await askWithDefault(rl, "Freeze this design package?", "yes");
    if (!isAffirmative(confirmed)) {
      throw new Error("Design interview aborted before freeze confirmation.");
    }

    return {
      targetStage: targetStage as DeliveryPolicyInput["targetStage"],
      reviewRequired: stageAtLeast(targetStage as typeof baseline.targetStage, "real-pr"),
      fallbackMode: "blocked-handoff",
      realPr: {
        targetBranch,
        featureBranchTemplate,
        titleTemplate,
      },
      dev,
      prod,
    };
  } finally {
    rl.close();
  }
}

async function promptForProdPolicy(
  rl: ReturnType<typeof createInterface>,
  defaults?: DeliveryPolicyInput["prod"],
): Promise<NonNullable<DeliveryPolicyInput["prod"]>> {
  const base = await promptForCommandPolicy(rl, "prod", defaults);
  const approved = await askWithDefault(rl, "Approve production deployment for this run? (yes/no)", defaults?.approvedForThisRun ? "yes" : "no");
  return {
    ...base,
    approvedForThisRun: isAffirmative(approved),
  };
}

async function promptForCommandPolicy(
  rl: ReturnType<typeof createInterface>,
  stage: "dev" | "prod",
  defaults?: DeliveryPolicyInput["dev"] | DeliveryPolicyInput["prod"],
): Promise<NonNullable<DeliveryPolicyInput["dev"]>> {
  const command = await askWithDefault(rl, `${stage} deploy command`, defaults?.command ?? "");
  const validationCommand = await askWithDefault(rl, `${stage} validation command`, defaults?.validationCommand ?? "");
  const runnerKind = await askWithDefault(rl, `${stage} runner kind (shell|external-command)`, defaults?.runnerKind ?? "shell");
  const envRefs = await askWithDefault(rl, `${stage} env refs (comma separated or blank)`, (defaults?.envRefs ?? []).join(","));
  return {
    command,
    validationCommand,
    runnerKind: runnerKind as NonNullable<DeliveryPolicyInput["dev"]>["runnerKind"],
    envRefs: parseCsv(envRefs),
  };
}

async function loadAnswersFile(path: string): Promise<InterviewAnswerFile> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as InterviewAnswerFile;
}

function legacyModelPolicyInput(args: Record<string, string>): ModelPolicyInput {
  return {
    surveyModels: args["survey-models"],
    approvedModels: args["approved-models"],
    designModel: args["design-model"],
    executionModel: args["execution-model"],
    verifierModel: args["verifier-model"],
    reasoningEfforts: args["reasoning-efforts"],
    fallbackChain: args["fallback-chain"],
    workUnitBudgetProfile: args["work-unit-budget-profile"],
  };
}

function definedEntries<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function renderPreflightSummary(doctor: DoctorResult): string {
  return [
    "V2 preflight summary",
    `- repository: ${doctor.repository.localWorkspace}`,
    ...doctor.preflightChecks.map((check) => `- ${check.code}: ${check.passed ? "passed" : "failed"} (${check.message})`),
    ...doctor.credentialGaps.map((gap) => `- credential gap: ${gap.code} (${gap.message})`),
    "",
  ].join("\n");
}

async function askWithDefault(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  defaultValue: string,
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await rl.question(`${prompt}${suffix}: `);
  return answer.trim() || defaultValue;
}

function inferBudgetProfile(approvedModels: string): string {
  return parseCsv(approvedModels).length > 1 ? "high_capability" : "low_capability";
}

function firstListEntry(value: string): string {
  return parseCsv(value)[0] ?? "";
}

function parseCsv(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function isAffirmative(value: string): boolean {
  return !value || ["y", "yes", "true"].includes(value.trim().toLowerCase());
}
