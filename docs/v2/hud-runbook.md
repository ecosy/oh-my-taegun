# HUD + OMT 실행 + 게임 데모 동시 관전 Runbook

## 목적

세 가지를 동시에 본다.

1. `watch`가 제공하는 브라우저 HUD
2. `OMT` CLI가 실제로 진행되는 터미널
3. `highway` 게임 데모 창

핵심 구분은 아래와 같다.

- `watch` = 로컬 HTTP 서버를 띄우는 CLI
- `HUD` = 브라우저에서 보는 상태판
- `OMT CLI` = 실제 `doctor -> design:v2 -> run:v2` 실행기
- `demo` = 자동차가 움직이는 `highway-env` 렌더 창

HUD는 `.omt/v2/*`와 `artifacts/*`를 읽고, 게임 데모는 `highway-env`를 렌더링한다.

## 대상 경로

### 완료된 예시 run

- `/Users/ryan/Documents/AI-Project/omt-highway-experiments/D/attempt-01/repo`

이 repo는 이미 `.omt/v2/events/*`, `report`가 있어서 채워진 HUD 예시를 보기 좋다.

### 새 실행 관전용 staged target

- `/Users/ryan/Documents/AI-Project/omt-highway-staged-toy-base`

이 repo는 staged baseline이며, 실제 OMT run을 보면서 HUD 변화를 보기 위한 대상이다.

### OMT 본 repo

- `/Users/ryan/Documents/AI-Project/oh-my-taegun`

## 권장 3터미널 구성

### 터미널 A: HUD 서버

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
npm run watch:v2 -- --repo-path /Users/ryan/Documents/AI-Project/omt-highway-staged-toy-base --port 4317
```

브라우저:

```text
http://127.0.0.1:4317
```

### 터미널 B: OMT 실행

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
npm run doctor -- --repo-path /Users/ryan/Documents/AI-Project/omt-highway-staged-toy-base --survey-models gpt-5.4 --approved-models gpt-5.4 --execution-model gpt-5.2-codex --verifier-model gpt-5.4 --work-unit-budget-profile low_capability
npm run design:v2 -- --repo-path /Users/ryan/Documents/AI-Project/omt-highway-staged-toy-base --survey-models gpt-5.4 --approved-models gpt-5.4 --execution-model gpt-5.2-codex --verifier-model gpt-5.4 --work-unit-budget-profile low_capability
npm run run:v2 -- --repo-path /Users/ryan/Documents/AI-Project/omt-highway-staged-toy-base
```

### 터미널 C: 게임 데모

```bash
cd /Users/ryan/Documents/AI-Project/omt-highway-staged-toy-base
npm run demo -- --level level-01 --seed 11
```

## 관전 모드 A: 완료된 실행 예시 보기

목적:

- HUD가 어떤 화면인지 바로 이해
- 기다림 없이 채워진 예시 보기

실행:

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
npm run watch:v2 -- --repo-path /Users/ryan/Documents/AI-Project/omt-highway-experiments/D/attempt-01/repo --port 4317
```

브라우저:

```text
http://127.0.0.1:4317
```

예상 표시값:

- `runId`: `20260314105534929`
- `phase`: `deliver`
- `currentWorkUnit`: `wu-001`
- changed files:
  - `src/omt_highway/agent.py`
  - `src/omt_highway/policy_utils.py`
- validation:
  - feature `true`
  - regression `true`
- delivery status:
  - `completed`

## 관전 모드 B: 새 실행을 실시간으로 보기

목적:

- OMT가 진행되면서 HUD가 변하는 걸 본다.

절차:

1. 터미널 A에서 staged repo용 `watch` 실행
2. 브라우저 열기
3. 터미널 B에서 `doctor`, `design:v2`, `run:v2` 순서대로 실행
4. HUD에서 다음이 바뀌는지 본다.
  - `runId`
  - `phase`
  - `currentWorkUnit`
  - `latestEvents`
  - `changedFiles`
  - `validation`
5. 필요하면 터미널 C에서 demo 실행

## HUD에서 보는 항목

### 상단

- `Run ID`
- `Phase`
- `Stage`

### 모델 정책

- `Surveyed`
- `Approved`
- `Design`
- `Execution`
- `Verifier`
- `Budget`

### 현재 work unit

- `workUnitId`
- `requirementIds`
- `acceptanceIds`
- `attempt`

### requirements 카드

- 각 requirement id와 title
- status:
  - `pending`
  - `active`
  - `changed`
  - `validated`
  - `blocked`

### 최근 이벤트

예시:

- `model_policy_confirmed`
- `work_unit_planned`
- `work_unit_started`
- `work_unit_completed`
- `validation_completed`
- `verifier_decision_recorded`
- `delivery_completed`
- `blocked_raised`

### changed files

예시:

- `src/omt_highway/agent.py`
- `src/omt_highway/policy_utils.py`

### validation

- feature pass/fail
- regression pass/fail
- delivery status
- delivery readiness

### replay hints

- level id
- seed
- demo command

### warnings

예시:

- 아직 run이 없으면 `No run detected ...`

## 화면별 의미 차이

### HUD

보는 것:

- OMT 상태
- 계획/실행/검증/전달 진행 상황

안 보이는 것:

- 자동차 움직임
- 실제 editor diff UI
- interactive interview chat UI

### OMT 터미널

보는 것:

- CLI 출력 JSON
- 실행 단계별 상태
- 에러와 blocked reason

### 게임 데모 창

보는 것:

- 자동차가 실제로 주행하는 장면
- step별 reward와 collision 출력

안 보이는 것:

- OMT의 work unit
- verifier decision
- delivery status

## 자주 보이는 상태

### HUD가 비어 보일 때

조건:

- `.omt/v2/events/*`가 없음

예상 상태:

- `runId = null`
- `phase = idle`
- `warnings`에 `No run detected ...`

의미:

- HUD가 고장난 게 아니라 아직 OMT run이 없다는 뜻

### replay hints가 없을 때

조건:

- `artifacts/replay/latest.json` 없음

예상 상태:

- `replayHints = []`

의미:

- replay artifact가 아직 생성되지 않음

### 게임 창은 뜨는데 HUD는 비어 있을 때

의미:

- demo는 단독 실행 가능
- HUD는 OMT state/artifact가 있어야 채워짐
- 둘은 연결될 수 있지만 같은 것은 아님

## 확인 포인트

### HUD 동작 확인

- 브라우저에서 `http://127.0.0.1:4317`
- `/api/health`가 `{ "ok": true }`
- `/api/snapshot`이 JSON 반환

### 완료된 run 예시 확인

- `runId`가 실제 값으로 보임
- latest events가 채워짐
- changed files가 채워짐
- validation이 `true/true`로 보임

### staged repo 실시간 관전 확인

- 초기: `idle`
- design 이후: `model policy` 채워짐
- run 중: `work unit`, `events`, `changed files` 갱신
- run 종료 후: `validation`, `delivery` 갱신

### 게임 데모 확인

- `npm run demo -- --level level-01 --seed 11`
- 별도 렌더 창 표시
- stdout에 `step=... collision=...` 출력

## 기본값

- HUD 포트 기본값: `4317`
- 호스트 기본값: `127.0.0.1`
- 실시간 관전 기본 target:
  - `/Users/ryan/Documents/AI-Project/omt-highway-staged-toy-base`
- 채워진 예시 확인 기본 target:
  - `/Users/ryan/Documents/AI-Project/omt-highway-experiments/D/attempt-01/repo`
- 게임 데모 기본 예시:
  - `level-01`
  - `seed 11`

## 최종 구분

이 문서의 목적은 다음 셋을 혼동하지 않게 하는 것이다.

- `watch/HUD` = OMT 상태판
- `OMT CLI` = 실제 실행기
- `demo` = 자동차 게임 화면

이 셋을 분리해서 보면, OMT가 문제를 푸는 과정과 자동차가 움직이는 장면을 동시에 관전할 수 있다.