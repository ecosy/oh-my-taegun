import type { DocumentSet } from "../../src/shared/types.js";

export function createDocumentSet(overrides?: Partial<DocumentSet>): DocumentSet {
  return {
    projectRoot: "/tmp/project",
    docsRoot: "/tmp/project/docs",
    profile: {
      version: 1,
      profile_id: "test-profile",
      product_id: "oh-my-taegun",
      source_documents: {},
      llm_execution: {
        backend: "codex-cli",
        model: "gpt-5.2-codex-xhigh",
        work_unit_strategy: "requirement-step",
        edit_mode: "direct-edit",
        execution_scope: "code-and-test",
        per_unit_max_attempts: 3,
        include_should_requirements: false,
      },
      tasks: [],
    },
    requirements: {
      requirements: [
        {
          id: "REQ-001",
          priority: "MUST",
          title: "First must requirement",
          description: "Implement the first must requirement.",
          source_refs: ["src-1"],
        },
        {
          id: "REQ-002",
          priority: "SHOULD",
          title: "Optional should requirement",
          description: "Implement the optional should requirement.",
          source_refs: ["src-2"],
        },
        {
          id: "REQ-003",
          priority: "MUST",
          title: "Second must requirement",
          description: "Implement the second must requirement.",
          source_refs: ["src-3"],
        },
      ],
    },
    acceptance: {
      acceptance_criteria: [
        {
          id: "AC-001",
          requirement_ids: ["REQ-001"],
          title: "Acceptance 1",
          description: "Acceptance for REQ-001.",
          verification: {},
        },
        {
          id: "AC-002",
          requirement_ids: ["REQ-003"],
          title: "Acceptance 2",
          description: "Acceptance for REQ-003.",
          verification: {},
        },
      ],
    },
    testPlan: {
      test_plan: [
        {
          id: "TP-001",
          acceptance_ids: ["AC-001"],
          category: "unit",
          method: "automated",
          stage: "nightly",
          description: "Test acceptance 1.",
        },
        {
          id: "TP-002",
          acceptance_ids: ["AC-002"],
          category: "unit",
          method: "automated",
          stage: "nightly",
          description: "Test acceptance 2.",
        },
      ],
    },
    taskContracts: { task_contracts: [] },
    stateSchema: {},
    testMatrix: {},
    ...overrides,
  };
}
