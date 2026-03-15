# OMT V2 Operator Guide

## Who This Guide Is For

이 문서는 V2를 직접 실행하는 운영자와 agent를 위한 실사용 가이드다. 실제 실행 전에 먼저 이 문서를 읽고, 그 다음에 [spec.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/spec.md)와 [state-schema.yaml](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/state-schema.yaml)을 참조한다.

## What Exists Today

- V2 CLI path는 구현되어 있다.
- `doctor`, `inspect`, `design`, `run`, `resume`, `report`, `watch`를 사용할 수 있다.
- `ExecutionModelPolicy`는 interview-derived 방식으로 생성된다.
- `design:v2`는 기본적으로 interactive interview를 수행한다.
- delivery policy는 design freeze에 포함된다.
- design artifact는 `.omt/v2/design/` 아래에 저장된다.
- run 상태는 event log와 snapshot으로 남는다.
- report와 resume는 V2 payload contract를 반환한다.
- `watch`는 `.omt/v2/*`와 target repo artifact를 읽는 읽기 전용 HUD 서버다.
- stage-based delivery runtime은 `dry-run -> commit -> real-pr -> dev -> prod` 순서를 사용한다.

## What Does Not Exist Yet

- interactive TUI
- team runtime
- SQLite/MCP state backend
- native skill runtime

## Golden Path

아래 4줄이 가장 단순한 V2 실사용 경로다. `gpt-5.2-codex`는 예시일 뿐이며, 회사에서 허용된 실제 모델 식별자로 바꿔 넣는다.

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
npm run design:v2 -- --repo-path /absolute/path/to/target-repo --survey-models gpt-5.2-codex --approved-models gpt-5.2-codex --execution-model gpt-5.2-codex --verifier-model gpt-5.2-codex
npm run run:v2 -- --repo-path /absolute/path/to/target-repo
npm run report:v2 -- --repo-path /absolute/path/to/target-repo --run-id <runId>
```

필요하면 마지막에 아래를 추가한다.

```bash
npm run resume:v2 -- --repo-path /absolute/path/to/target-repo --run-id <runId>
```

문제가 있을 때만 아래처럼 `doctor`를 별도 진단용으로 먼저 실행한다.

```bash
npm run doctor -- --repo-path /absolute/path/to/target-repo --survey-models gpt-5.2-codex --approved-models gpt-5.2-codex --execution-model gpt-5.2-codex --verifier-model gpt-5.2-codex
```

## Single Approved Model Example

모델이 하나만 허용되면 아래처럼 같은 값을 반복해서 넣는다.

```bash
npm run design:v2 -- --repo-path /absolute/path/to/target-repo --survey-models gpt-5.2-codex --approved-models gpt-5.2-codex --execution-model gpt-5.2-codex --verifier-model gpt-5.2-codex
```

## Two Approved Models Example

execution과 verifier를 분리하고 싶으면 아래처럼 넣는다.

```bash
npm run design:v2 -- --repo-path /absolute/path/to/target-repo --survey-models gpt-5.2-codex,gpt-5.4 --approved-models gpt-5.2-codex,gpt-5.4 --execution-model gpt-5.2-codex --verifier-model gpt-5.4 --work-unit-budget-profile high_capability
```

`company-low` 같은 이름은 테스트 fixture용 예시일 뿐이고, 운영 문서에서는 실제 회사 모델 식별자를 사용한다.

## How To Read Outputs

- `doctor`
  - `modelEnvironmentSurvey`, `gitRuntimeContext`, `preflightChecks`, `credentialGaps`, `verifiedCapabilityReport`를 본다.
- `design`
  - `executionModelPolicy`, `deliveryPolicy`, `ambiguityScorecard`, `ontologySeed`, `status`, `blockedReasons`를 본다.
- `run`
  - `runId`, `phase`, `status`, `verifierDecisions`, `blockedReasons`, `currentStage`를 본다.
- `report`
  - `executionModelPolicy`, `deliveryPolicy`, `reviewerDecision`, `stageTimeline`, `convergenceSnapshot`, `pathologySignals`, `validationSummary`, `deliveryStatus`를 본다.
- `resume`
  - `phase`, `executionModelPolicy`, `deliveryPolicy`, `reviewerDecision`, `snapshot`, `handoff`, `currentStage`, `completedStages`, `nextActions`를 본다.
- `watch`
  - 브라우저에서 `runId`, `phase`, `currentStage`, `currentWorkUnit`, `latestEvents`, `changedFiles`, `validation`, `replayHints`, `warnings`를 본다.

## Watch HUD

`watch`는 로컬 HTTP 서버를 띄우고, 브라우저 HUD가 target repo의 `.omt/v2/*`와 `artifacts/*`를 읽도록 해준다.

가장 단순한 실행은 아래와 같다.

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
npm run watch:v2 -- --repo-path /absolute/path/to/target-repo --port 4317
```

브라우저에서 아래 주소를 연다.

```text
http://127.0.0.1:4317
```

HUD는 다음을 보여준다.

- `Run ID`
- `Phase`
- `Stage`
- 모델 정책
- 현재 work unit
- requirement status
- 최근 이벤트
- changed files
- validation
- replay hints
- warnings

아직 run이 없으면 `idle` 상태와 `No run detected ...` 경고가 보인다.

실행 예시와 3터미널 관전 흐름은 [hud-runbook.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/hud-runbook.md)에 정리한다.

## Files Written By Each Phase

- design
  - `.omt/v2/design/model-survey.json`
  - `.omt/v2/design/interview.jsonl`
  - `.omt/v2/design/ontology.json`
  - `.omt/v2/design/seed.json`
- run
  - `.omt/v2/events/<run-id>.jsonl`
  - `.omt/v2/state/run.json`
  - `.omt/v2/snapshots/<run-id>/snapshot-*.json`
  - `.omt/v2/handoffs/<run-id>/handoff.md`
- report
  - `.omt/v2/reports/<run-id>.json`
- resume
  - event log와 snapshot을 읽어 현재 phase를 재구성한다.

## Failure Modes

- model policy 미확정
  - 승인 모델이 여러 개인데 기본 execution/verifier 모델이 비어 있으면 blocked 된다.
- interactive design on non-TTY
  - 대화형 `design:v2`는 TTY가 필요하다. 자동화에서는 `--non-interactive --answers-file`을 사용한다.
- `seed.json` 미생성
  - ambiguity가 높거나 design freeze 조건이 안 맞으면 생성되지 않는다.
- unverified capability 때문에 blocked
  - 검증되지 않은 capability는 실행 가능하다고 가정하지 않는다.
- reviewer blocked promotion
  - `real-pr` 이상 stage는 reviewer가 local diff 승격을 허용하지 않으면 blocked 된다.
- production approval missing
  - `prod` stage는 run별 승인 없이는 freeze되지 않는다.
- doctor preflight 실패
  - `working_tree_clean`, `verified_test_commands`, `workspace_writable` 같은 preflight check가 실패하면 야간 실행 대상으로 보기 어렵다.
- run 완료 후 report 확인 필요
  - `completed`만 보지 말고 `validationSummary`와 `deliveryStatus`를 같이 본다.

## Acceptance Checklist

- `seed.json`이 존재한다.
- event log가 존재한다.
- `run` 결과가 `completed`다.
- `report`에 `executionModelPolicy`가 있다.
- `report`에 `deliveryPolicy`와 `stageTimeline`이 있다.
- `report`에 `validationSummary`가 있다.

## Optional Real Model Smoke

deterministic fake-Codex suite가 기본 acceptance다. 실제 회사 모델로 연동 상태를 확인하고 싶을 때만 guarded smoke를 사용한다.

```bash
OMT_ENABLE_REAL_MODEL_SMOKE=1 OMT_REAL_MODEL_NAME=gpt-5.2-codex npm run test:e2e:v2:real-smoke
```

기대 결과는 아래 둘 중 하나다.

- `completed`
- `blocked`

`blocked`도 허용된다. real-model smoke의 목적은 실제 모델 연결과 V2 경로가 망가지지 않았는지 확인하는 것이지, 모든 저장소에서 delivery-ready 결과를 강제하는 것이 아니다.

## Reference Specs

- [spec.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/spec.md)
- [model-contracts.yaml](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/model-contracts.yaml)
- [state-schema.yaml](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/state-schema.yaml)
- [migration.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/migration.md)
