# OMT V2 Operator Guide

## Who This Guide Is For

이 문서는 V2를 직접 실행하는 운영자와 agent를 위한 실사용 가이드다. 실제 실행 전에 먼저 이 문서를 읽고, 그 다음에 [spec.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/spec.md)와 [state-schema.yaml](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/state-schema.yaml)을 참조한다.

## What Exists Today

- V2 CLI path는 구현되어 있다.
- `doctor`, `inspect`, `design`, `run`, `resume`, `report`를 사용할 수 있다.
- `ExecutionModelPolicy`는 interview-derived 방식으로 생성된다.
- design artifact는 `.omt/v2/design/` 아래에 저장된다.
- run 상태는 event log와 snapshot으로 남는다.
- report와 resume는 V2 payload contract를 반환한다.

## What Does Not Exist Yet

- TUI/HUD
- interactive interview
- team runtime
- SQLite/MCP state backend
- stronger delivery runtime

## Golden Path

아래 5줄이 가장 단순한 V2 실사용 경로다. `gpt-5.2-codex`는 예시일 뿐이며, 회사에서 허용된 실제 모델 식별자로 바꿔 넣는다.

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
npm run doctor -- --repo-path /absolute/path/to/target-repo --survey-models gpt-5.2-codex --approved-models gpt-5.2-codex --execution-model gpt-5.2-codex --verifier-model gpt-5.2-codex
npm run design:v2 -- --repo-path /absolute/path/to/target-repo --survey-models gpt-5.2-codex --approved-models gpt-5.2-codex --execution-model gpt-5.2-codex --verifier-model gpt-5.2-codex
npm run run:v2 -- --repo-path /absolute/path/to/target-repo
npm run report:v2 -- --repo-path /absolute/path/to/target-repo --run-id <runId>
```

필요하면 마지막에 아래를 추가한다.

```bash
npm run resume:v2 -- --repo-path /absolute/path/to/target-repo --run-id <runId>
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
  - `modelEnvironmentSurvey`, `gitRuntimeContext`, `credentialGaps`, `verifiedCapabilityReport`를 본다.
- `design`
  - `executionModelPolicy`, `ambiguityScorecard`, `ontologySeed`, `status`, `blockedReasons`를 본다.
- `run`
  - `runId`, `phase`, `status`, `verifierDecisions`, `blockedReasons`를 본다.
- `report`
  - `executionModelPolicy`, `convergenceSnapshot`, `pathologySignals`, `validationSummary`, `deliveryStatus`를 본다.
- `resume`
  - `phase`, `executionModelPolicy`, `snapshot`, `handoff`, `nextActions`를 본다.

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
- `seed.json` 미생성
  - ambiguity가 높거나 design freeze 조건이 안 맞으면 생성되지 않는다.
- unverified capability 때문에 blocked
  - 검증되지 않은 capability는 실행 가능하다고 가정하지 않는다.
- run 완료 후 report 확인 필요
  - `completed`만 보지 말고 `validationSummary`와 `deliveryStatus`를 같이 본다.

## Acceptance Checklist

- `seed.json`이 존재한다.
- event log가 존재한다.
- `run` 결과가 `completed`다.
- `report`에 `executionModelPolicy`가 있다.
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
