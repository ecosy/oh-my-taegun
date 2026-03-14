# OMT V2 Spec Narrative

For actual operation, read `docs/v2/operator-guide.md` first. This document is the concept and contract narrative, not the step-by-step operator procedure.

## Core Flow

`doctor -> model survey -> interview -> ontology -> seed -> freeze -> plan -> execute -> verify -> converge -> deliver -> report`

## Product Principles

- No hardcoded baseline model
- Interview-derived model policy
- Acceptance-equivalent outcome across approved model policies
- Solo-first runtime
- Sequential execution
- Append-only event log as source of truth
- Snapshot as derived recovery view

## Role Model

- `interviewer`: collects missing intent, policy, and model constraints
- `ontologist`: normalizes concepts and schema boundaries
- `planner`: emits bounded work units
- `executor`: performs repository changes within budget
- `verifier`: separates design convergence from implementation completion

## Design Package

A frozen design package contains:

- repository context
- verified capability report
- execution model policy
- ambiguity scorecard
- ontology seed
- open question count
- approval record

## Completion Rules

- Seed freeze requires confirmed execution model policy.
- Design convergence does not imply implementation completion.
- Implementation completion does not override ontology drift.
- Delivery never proceeds when required validation is missing.

## Recovery Rules

- Event log is the source of truth.
- Snapshot is a convenience view.
- Resume is phase-aware and must reconstruct the active model policy.

## CLI Contracts

- `omt doctor`: produces environment and model survey evidence
- `omt inspect`: produces verified capability evidence through read-only inspection
- `omt design`: produces design package and execution model policy
- `omt run`: consumes frozen design package
- `omt resume`: restores phase, snapshot, handoff, and model policy
- `omt report`: emits ambiguity, convergence, pathology, validation, delivery, and model policy summary
