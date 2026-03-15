# AGENTS.md

## Start Here

이 저장소를 조작하는 agent는 아래 순서로 문서를 읽는다.

1. `AGENTS.md`
2. `docs/v2/operator-guide.md`
3. `docs/v2/spec.md`
4. `docs/v2/state-schema.yaml`

V2를 실제로 실행하려면 먼저 `docs/v2/operator-guide.md`를 읽고, 그 다음에 `docs/v2/spec.md`와 `docs/v2/state-schema.yaml`으로 계약을 확인한다.

## Current Runtime Status

- V2 CLI path는 구현되어 있다.
- `doctor`, `inspect`, `design`, `run`, `resume`, `report`의 V2 runtime path가 있다.
- 읽기 전용 `watch` HUD가 있다.
- interactive interview는 아직 없다.
- team runtime, tmux, mailbox, rebalance는 범위 밖이다.
- 상태 저장 기본은 `.omt/v2/*.json` 및 `.jsonl`이다.

## V1 vs V2 Rule

- 기본 명령 경로는 V1이다.
- V2는 반드시 `--profile docs/v2/spec.yaml` 또는 `npm run *:v2`로 진입한다.
- `doctor`와 `inspect`는 V2 public command로 취급한다.
- V2 상태는 `.omt/v2/` 아래에 기록되며 기존 `.omt/` V1 상태를 대체하지 않는다.

## Golden Path

- `design:v2 -> run:v2 -> report:v2 -> resume:v2`

`doctor`는 선택적인 진단/디버그 경로로 유지된다.

## Required Flags

- `--repo-path`
- `--survey-models`
- `--approved-models`
- `--execution-model`
- `--verifier-model`
- `--work-unit-budget-profile`

## Artifacts To Check

- `.omt/v2/design/model-survey.json`
- `.omt/v2/design/interview.jsonl`
- `.omt/v2/design/ontology.json`
- `.omt/v2/design/seed.json`
- `.omt/v2/events/<run-id>.jsonl`
- `.omt/v2/snapshots/<run-id>/snapshot-*.json`
- `.omt/v2/reports/<run-id>.json`

## Done vs Not Done

구현된 것:

- V2 CLI command surface
- interview-derived `ExecutionModelPolicy`
- interactive `design:v2` interview
- read-only `watch` HUD
- delivery policy freeze and stage-based delivery runtime
- design artifact persistence
- budget-aware planning
- event log, snapshot, report, resume
- low/high policy parity tests

아직 아닌 것:

- interactive TUI
- team runtime
- SQLite/MCP backend

## Do Not Assume

- baseline 모델명을 코드나 운영 절차에 하드코딩하지 않는다.
- `seed.json`이 생기기 전에는 design freeze를 가정하지 않는다.
- ontology convergence만으로 완료를 판정하지 않는다.
- `unverified` capability를 실행 가능하다고 가정하지 않는다.
