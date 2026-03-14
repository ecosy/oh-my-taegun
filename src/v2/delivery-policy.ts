import type { DocumentSet } from "../shared/types.js";
import type { DeliveryCommandPolicy, DeliveryPolicy, DeliveryPolicyInput, DeliveryTargetStage, QuestionRecord } from "./types.js";

const STAGE_ORDER: DeliveryTargetStage[] = ["dry-run", "commit", "real-pr", "dev", "prod"];

export function buildDeliveryPolicy(
  documents: DocumentSet,
  input?: DeliveryPolicyInput,
): DeliveryPolicy {
  const targetStage = input?.targetStage ?? "dry-run";
  const profileDelivery = documents.profile.delivery;
  const realPr = {
    targetBranch: input?.realPr?.targetBranch ?? profileDelivery?.branch_strategy?.target_branch ?? "develop",
    featureBranchTemplate: input?.realPr?.featureBranchTemplate ?? profileDelivery?.branch_strategy?.feature_branch_template ?? "feature/omt-v2-{run_id}",
    titleTemplate: input?.realPr?.titleTemplate ?? "oh-my-taegun: {run_id}",
  };
  const reviewRequired = requiresReview(targetStage) ? true : input?.reviewRequired ?? false;
  const dev = normalizeCommandPolicy(input?.dev) as DeliveryPolicy["dev"];
  const prod = normalizeCommandPolicy(input?.prod, { allowApproval: true }) as DeliveryPolicy["prod"];
  const openQuestions = collectDeliveryOpenQuestions({
    targetStage,
    realPr,
    dev,
    prod,
  });

  return {
    targetStage,
    reviewRequired,
    fallbackMode: "blocked-handoff",
    realPr,
    dev,
    prod,
    openQuestions,
  };
}

export function buildDeliveryPolicyQuestionRecords(
  policy: DeliveryPolicy,
  input?: DeliveryPolicyInput,
): QuestionRecord[] {
  const targetExplicit = Boolean(input?.targetStage);
  const targetStage = policy.targetStage;
  const records: QuestionRecord[] = [
    {
      id: "delivery-target-stage",
      question: "Which delivery stage should this V2 run target?",
      answer: targetStage,
      required: true,
      source: "operator" as const,
      slot: "delivery_policy_clarity",
      status: targetExplicit ? "answered" : "assumed",
      blocking: false,
    },
    {
      id: "delivery-review-required",
      question: "Is reviewer approval required before remote promotion?",
      answer: policy.reviewRequired ? "yes" : "no",
      required: stageAtLeast(targetStage, "real-pr"),
      source: "operator" as const,
      slot: "delivery_policy_clarity",
      status: stageAtLeast(targetStage, "real-pr")
        ? "verified"
        : (input?.reviewRequired === undefined ? "assumed" : "answered"),
      blocking: false,
    },
  ];

  if (stageAtLeast(targetStage, "real-pr")) {
    records.push(...[
      {
        id: "delivery-real-pr-target-branch",
        question: "Which target branch should PR delivery use?",
        answer: policy.realPr.targetBranch,
        required: true,
        source: "operator" as const,
        slot: "delivery_policy_clarity",
        status: (input?.realPr?.targetBranch ? "answered" : (policy.realPr.targetBranch ? "assumed" : "unanswered")) as QuestionRecord["status"],
        blocking: !policy.realPr.targetBranch,
      },
      {
        id: "delivery-real-pr-feature-branch-template",
        question: "Which feature branch template should V2 use for delivery?",
        answer: policy.realPr.featureBranchTemplate,
        required: true,
        source: "operator" as const,
        slot: "delivery_policy_clarity",
        status: (input?.realPr?.featureBranchTemplate ? "answered" : (policy.realPr.featureBranchTemplate ? "assumed" : "unanswered")) as QuestionRecord["status"],
        blocking: !policy.realPr.featureBranchTemplate,
      },
      {
        id: "delivery-real-pr-title-template",
        question: "Which PR title template should V2 use?",
        answer: policy.realPr.titleTemplate,
        required: true,
        source: "operator" as const,
        slot: "delivery_policy_clarity",
        status: (input?.realPr?.titleTemplate ? "answered" : (policy.realPr.titleTemplate ? "assumed" : "unanswered")) as QuestionRecord["status"],
        blocking: !policy.realPr.titleTemplate,
      },
    ]);
  }

  if (stageAtLeast(targetStage, "dev")) {
    records.push(...commandQuestionRecords("dev", policy.dev, input?.dev));
  }

  if (targetStage === "prod") {
    records.push(...commandQuestionRecords("prod", policy.prod, input?.prod));
    records.push({
      id: "delivery-prod-approval",
      question: "Is production deployment approved for this run?",
      answer: policy.prod?.approvedForThisRun ? "yes" : "no",
      required: true,
      source: "operator" as const,
      slot: "delivery_policy_clarity",
      status: policy.prod?.approvedForThisRun ? "answered" : "unanswered",
      blocking: !policy.prod?.approvedForThisRun,
    });
  }

  return records;
}

export function stageAtLeast(stage: DeliveryTargetStage, candidate: DeliveryTargetStage): boolean {
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(candidate);
}

export function defaultTargetStage(): DeliveryTargetStage {
  return "dry-run";
}

function commandQuestionRecords(
  stage: "dev" | "prod",
  policy: DeliveryPolicy["dev"] | DeliveryPolicy["prod"],
  input?: DeliveryPolicyInput["dev"] | DeliveryPolicyInput["prod"],
): QuestionRecord[] {
  return [
    {
      id: `delivery-${stage}-command`,
      question: `Which ${stage} deployment command should V2 run?`,
      answer: policy?.command,
      required: true,
      source: "operator" as const,
      slot: "delivery_policy_clarity",
      status: (input?.command ? "answered" : (policy?.command ? "assumed" : "unanswered")) as QuestionRecord["status"],
      blocking: !policy?.command,
    },
    {
      id: `delivery-${stage}-validation-command`,
      question: `Which ${stage} validation command should V2 run after deployment?`,
      answer: policy?.validationCommand,
      required: true,
      source: "operator" as const,
      slot: "delivery_policy_clarity",
      status: (input?.validationCommand ? "answered" : (policy?.validationCommand ? "assumed" : "unanswered")) as QuestionRecord["status"],
      blocking: !policy?.validationCommand,
    },
    {
      id: `delivery-${stage}-runner-kind`,
      question: `Which runner kind should V2 use for ${stage} delivery commands?`,
      answer: policy?.runnerKind,
      required: true,
      source: "operator" as const,
      slot: "delivery_policy_clarity",
      status: (input?.runnerKind ? "answered" : (policy?.runnerKind ? "assumed" : "unanswered")) as QuestionRecord["status"],
      blocking: !policy?.runnerKind,
    },
  ];
}

function collectDeliveryOpenQuestions(input: {
  targetStage: DeliveryTargetStage;
  realPr: DeliveryPolicy["realPr"];
  dev?: DeliveryPolicy["dev"];
  prod?: DeliveryPolicy["prod"];
}): string[] {
  const questions: string[] = [];

  if (stageAtLeast(input.targetStage, "real-pr")) {
    if (!input.realPr.targetBranch) {
      questions.push("Real PR target branch is missing.");
    }
    if (!input.realPr.featureBranchTemplate) {
      questions.push("Real PR feature branch template is missing.");
    }
    if (!input.realPr.titleTemplate) {
      questions.push("Real PR title template is missing.");
    }
  }

  if (stageAtLeast(input.targetStage, "dev")) {
    if (!input.dev?.command) {
      questions.push("Dev deployment command is missing.");
    }
    if (!input.dev?.validationCommand) {
      questions.push("Dev validation command is missing.");
    }
  }

  if (input.targetStage === "prod") {
    if (!input.prod?.command) {
      questions.push("Prod deployment command is missing.");
    }
    if (!input.prod?.validationCommand) {
      questions.push("Prod validation command is missing.");
    }
    if (!input.prod?.approvedForThisRun) {
      questions.push("Production deployment is not approved for this run.");
    }
  }

  return questions;
}

function normalizeCommandPolicy(
  policy?: Partial<DeliveryCommandPolicy> | (Partial<DeliveryCommandPolicy> & { approvedForThisRun?: boolean }),
  options?: { allowApproval?: boolean },
): DeliveryPolicy["dev"] | DeliveryPolicy["prod"] | undefined {
  if (!policy) {
    return undefined;
  }

  const normalized = {
    runnerKind: policy.runnerKind ?? "shell",
    command: policy.command?.trim() ?? "",
    validationCommand: policy.validationCommand?.trim() ?? "",
    envRefs: [...new Set((policy.envRefs ?? []).filter(Boolean))],
  };
  if (!normalized.command && !normalized.validationCommand) {
    return undefined;
  }
  if (options?.allowApproval) {
    return {
      ...normalized,
      approvedForThisRun: Boolean((policy as { approvedForThisRun?: boolean }).approvedForThisRun),
    };
  }
  return normalized;
}

function requiresReview(stage: DeliveryTargetStage): boolean {
  return stageAtLeast(stage, "real-pr");
}
