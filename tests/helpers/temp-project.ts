import { cp, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DeliveryMode, Requirement } from "../../src/shared/types.js";
import { projectRoot } from "./project-root.js";

interface TempProjectOptions {
  profileId: string;
  deliveryMode?: DeliveryMode;
  requirements: Requirement[];
  acceptance: Array<{
    id: string;
    requirement_ids: string[];
    title: string;
    description: string;
    verification: Record<string, unknown>;
  }>;
  testPlan: Array<{
    id: string;
    acceptance_ids: string[];
    category: string;
    method: string;
    stage: string;
    description: string;
  }>;
}

export async function createTempProjectDocs(options: TempProjectOptions): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "omt-project-"));
  const docsRoot = join(root, "docs");
  await mkdir(docsRoot, { recursive: true });

  await Promise.all([
    cp(join(projectRoot, "docs", "task-contracts.yaml"), join(docsRoot, "task-contracts.yaml")),
    cp(join(projectRoot, "docs", "state-schema.yaml"), join(docsRoot, "state-schema.yaml")),
    cp(join(projectRoot, "docs", "test-matrix.yaml"), join(docsRoot, "test-matrix.yaml")),
  ]);

  await writeFile(join(docsRoot, "scope-freeze.md"), "# scope freeze\nfixture e2e\n");
  await writeFile(join(docsRoot, "design_summary.md"), "# design summary\nfixture e2e\n");
  await writeFile(join(docsRoot, "implementation-spec.md"), "# implementation spec\nfixture e2e\n");

  await writeFile(join(docsRoot, "spec.yaml"), `${JSON.stringify({
    version: 1,
    profile_id: options.profileId,
    product_id: "oh-my-taegun",
    source_documents: {
      scope_freeze: "docs/scope-freeze.md",
      requirements: "docs/requirements.yaml",
      acceptance: "docs/acceptance.yaml",
      test_plan: "docs/test-plan.yaml",
      design_summary: "docs/design_summary.md",
      implementation_spec: "docs/implementation-spec.md",
      state_schema: "docs/state-schema.yaml",
      task_contracts: "docs/task-contracts.yaml",
      test_matrix: "docs/test-matrix.yaml",
    },
    validation: {
      required: ["feature_validation", "regression_validation"],
      gate_order: ["traceability", "implementation", "feature_validation", "regression_validation", "delivery"],
    },
    llm_execution: {
      backend: "codex-cli",
      model: "gpt-5.4",
      work_unit_strategy: "requirement-step",
      edit_mode: "direct-edit",
      execution_scope: "code-and-test",
      per_unit_max_attempts: 3,
      include_should_requirements: false,
      codex: {
        sandbox: "workspace-write",
        approval: "never",
        json_output: true,
      },
    },
    delivery: {
      target_outcome: options.deliveryMode ?? "dry-run",
      branch_strategy: {
        feature_branch_template: "feature/omt-{run_id}",
        target_branch: "develop",
        update_existing_branch_if_present: true,
      },
      pr_strategy: {
        mode: options.deliveryMode === "real-pr" ? "real" : "dry-run",
        update_existing_pr_if_present: true,
      },
    },
    tasks: [
      { id: "intake", type: "repo_intake" },
      { id: "discover_capabilities", type: "capability_discovery" },
      { id: "design_interview", type: "interactive_design" },
      { id: "freeze_requirements", type: "freeze_scope_and_requirements" },
      { id: "implement", type: "implement_changes" },
      { id: "validate", type: "run_validation_gates" },
      { id: "deliver", type: "create_or_update_real_pr" },
      { id: "morning_report", type: "summarize_outcome" },
    ],
  }, null, 2)}\n`);
  await writeFile(join(docsRoot, "requirements.yaml"), `${JSON.stringify({ requirements: options.requirements }, null, 2)}\n`);
  await writeFile(join(docsRoot, "acceptance.yaml"), `${JSON.stringify({ acceptance_criteria: options.acceptance }, null, 2)}\n`);
  await writeFile(join(docsRoot, "test-plan.yaml"), `${JSON.stringify({ test_plan: options.testPlan }, null, 2)}\n`);

  return root;
}
