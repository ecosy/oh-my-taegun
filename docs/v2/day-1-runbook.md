# OMT V2 Day-1 Runbook

## 목적

이 문서는 `회사 로컬 개발환경에서 Codex 사용 가능`을 전제로, 내일 바로 OMT를 붙이는 첫날 운영 절차를 정리한다. 기준 문서는 [AGENTS.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/AGENTS.md), [operator-guide.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/operator-guide.md), [spec.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/spec.md), [state-schema.yaml](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/state-schema.yaml) 이다.

## 내일의 목표

- 회사 장비에서 OMT 엔진 repo를 clone하고 실행할 수 있다.
- target repo 하나를 정해서 `design:v2 -> run:v2 -> report:v2`를 끝까지 돌릴 수 있다.
- `.omt/v2/` artifact가 생성되고, blocked면 blocked reason을 읽을 수 있다.
- 첫 run은 최소 `dry-run` 완료, 이상적이면 같은 날 `commit` 완료를 목표로 한다.
- `real-pr`, `dev`, `prod`는 첫날 성공 기준에 넣지 않는다.

## 오늘 밤 준비할 것

- 회사에서 접근 가능한 위치에 OMT repo를 clone할 준비를 한다.
- target repo 하나를 고른다.
  - 테스트 명령이 분명하고 작업 범위가 작은 repo가 가장 좋다.
  - 첫날에는 복잡한 mono-repo나 배포 의존성이 큰 repo는 피한다.
- 회사에서 허용된 모델 식별자를 확인한다.
  - `--survey-models`
  - `--approved-models`
  - `--execution-model`
  - `--verifier-model`
- target repo의 검증 명령을 미리 확인한다.
  - 예: `npm test`, `pnpm test`, `pytest`, `cargo test`
- 첫날 target stage는 `dry-run`, 조건이 좋으면 `commit`으로 고정한다.
- 같은 날 `real-pr`까지 검토하고 싶다면 GitHub 토큰과 push 권한이 있는지 먼저 확인한다.

## 내일 아침 설치 절차

```bash
git clone <repo-url>
cd oh-my-taegun
npm install
```

문서는 아래 순서로 읽는다.

1. [AGENTS.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/AGENTS.md)
2. [operator-guide.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/operator-guide.md)

Codex skill 설치:

```bash
./scripts/install-codex-skill.sh omt
```

설치 후 확인:

- `~/.codex/skills/omt`가 symlink인지 확인
- `~/.codex/skills/omt/SKILL.md`가 열리는지 확인
- Codex에서 `$omt`를 호출할 수 있는지 확인

## 첫 실행 방식

기본은 `$omt`를 사용한다. skill은 내부적으로 `design:v2 --non-interactive --answers-file`를 호출하므로, 사람이 TTY interview를 직접 다루지 않아도 된다. source of truth는 여전히 CLI와 `.omt/v2/` artifact다.

권장 첫 프롬프트:

```text
$omt를 사용해서 OMT V2를 /absolute/path/to/target-repo 에 실행해주세요.
먼저 target stage는 dry-run으로 시작해주세요.
채팅으로 model policy와 delivery policy를 수집하고, 모호한 답변은 다시 질문해주세요.
필수 입력이 닫히지 않으면 실행하지 말고 중단해주세요.
실행 후에는 runId, 현재 phase, 현재 stage, completed stages, blocked reasons, report 경로를 요약해주세요.
```

`dry-run`이 깔끔하게 끝났을 때 같은 날 `commit`까지 올리는 프롬프트:

```text
$omt를 사용해서 /absolute/path/to/target-repo 에 대해 OMT V2를 다시 실행해주세요.
이번 target stage는 commit입니다.
이전 dry-run 결과를 참고하되, 필요한 입력은 다시 검증해주세요.
마지막에는 최종 상태와 report 요약을 알려주세요.
```

## raw CLI fallback

skill 사용이 막히거나 회사 정책상 skill 사용이 애매하면 CLI로 바로 간다.

```bash
npm run design:v2 -- --repo-path /absolute/path/to/target-repo --survey-models <approved-models> --approved-models <approved-models> --execution-model <execution-model> --verifier-model <verifier-model> --work-unit-budget-profile <budget-profile>
npm run run:v2 -- --repo-path /absolute/path/to/target-repo
npm run report:v2 -- --repo-path /absolute/path/to/target-repo --run-id <runId>
```

blocked 후 재확인:

```bash
npm run resume:v2 -- --repo-path /absolute/path/to/target-repo --run-id <runId>
```

진단이 필요할 때만:

```bash
npm run doctor -- --repo-path /absolute/path/to/target-repo --survey-models <approved-models> --approved-models <approved-models> --execution-model <execution-model> --verifier-model <verifier-model>
```

## 첫날에 확인할 것

- skill entrypoint: `$omt`
- CLI entrypoint:
  - `npm run design:v2`
  - `npm run run:v2`
  - `npm run report:v2`
  - `npm run resume:v2`
  - 필요할 때만 `npm run doctor`
- artifact:
  - `.omt/v2/design/model-survey.json`
  - `.omt/v2/design/interview.jsonl`
  - `.omt/v2/design/seed.json`
  - `.omt/v2/events/<run-id>.jsonl`
  - `.omt/v2/reports/<run-id>.json`

## 첫날 운영 규칙

- 첫 실행은 작은 작업으로 한다.
  - bugfix 1건
  - 테스트 보강 1건
  - 문서-코드 정합화 1건
- 대형 리팩터, 배포, 멀티서비스 변경은 첫날 범위 밖으로 둔다.
- `seed.json`이 생기기 전에는 design freeze가 된 것으로 간주하지 않는다.
- `report`를 읽기 전에는 성공으로 간주하지 않는다.
- `unverified` capability는 실행 가능하다고 가정하지 않는다.
- blocked면 억지로 밀지 말고 `report`와 `resume`을 본다.

## 첫날 성공 기준

- `design:v2`가 정상 종료되고 `seed.json`이 생성된다.
- `run:v2`가 `dry-run` 또는 `commit` 단계까지 완료된다.
- `report:v2`에서 아래가 확인된다.
  - `executionModelPolicy`
  - `deliveryPolicy`
  - `validationSummary`
  - `deliveryStatus`
- blocked일 경우에도 아래가 명확히 남는다.
  - blocked reason
  - current phase
  - current stage
  - next action

## 실패 시 대응

- `design`에서 막힘
  - 모델 정책, budget profile, stage 입력, verified test command를 다시 점검한다.
  - 필요하면 `doctor`를 추가로 돌린다.
- `run`에서 막힘
  - target repo의 테스트 명령과 작업 트리 상태를 점검한다.
  - `.omt/v2/reports/<run-id>.json`과 `.omt/v2/events/<run-id>.jsonl`를 읽는다.
- skill이 막힘
  - 같은 입력으로 raw CLI fallback 경로로 전환한다.
- 사내 네트워크나 권한 문제
  - 첫날 목표를 `dry-run`으로 낮추고 local validation까지만 본다.
