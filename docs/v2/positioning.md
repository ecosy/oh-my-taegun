# OMT V2 Positioning

## Goal

- OMT V2 is a spec-first autonomous development harness.
- V2 must work under interview-derived model policy instead of a hardcoded baseline model.
- V2 keeps solo-first operation and does not require team runtime, tmux, HUD, or MCP services.

## Product Definition

- The system collects repository facts, operator constraints, and model policy during design.
- The system freezes a design package only after ambiguity is below threshold and model policy is confirmed.
- The system executes implementation work through role-separated phases:
  - interviewer
  - ontologist
  - planner
  - executor
  - verifier
- The system stores append-only events and derived snapshots for recovery.

## Non-goals

- Team runtime
- Mailbox or rebalance orchestration
- tmux or HUD requirements
- MCP-required architecture
- Hardcoded baseline model such as `gpt-5.2 Codex`

## V1 Compatibility

- V1 tests remain the regression floor.
- V2 adds documents and tests without deleting the current V1 execution path.
- V2 model policy is interview-derived and may point to any approved model available in the operator environment.
