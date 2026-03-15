# oh-my-taegun

`oh-my-taegun`은 "낮 설계 -> 밤 자동 구현 -> 아침 검토"를 목표로 하는 로컬 우선 자율 개발 하네스입니다.

## Start Here

V2를 실제로 실행하려면 먼저 [AGENTS.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/AGENTS.md)와 [docs/v2/operator-guide.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/operator-guide.md)를 읽는다. 개념과 계약은 [docs/v2/spec.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/spec.md)에서 확인한다.

- 기본 명령 경로는 V1이다.
- V2는 explicit profile로만 활성화된다.
- V2 상태는 `.omt/v2/` 아래에 저장된다.

현재 단계의 핵심 원칙은 다음과 같습니다.

- 1차 사용자는 단일 운영자 1명
- 개발과 실사용은 로컬 git 중심
- 저장소 입력은 `git URL` 또는 로컬 clone 경로
- 야간 실행은 코드 수정, 설치, 테스트, 배포, 외부 연동까지 포함 가능
- 아침 산출물 목표는 `feature -> develop` real PR
- 정책/권한/검증 미충족 시에는 무리하게 push하지 않고 `blocked report`로 종료

## 현재 상태

이 저장소는 문서 기반 설계를 바탕으로 동작 가능한 로컬 우선 CLI 스캐폴드까지 구현된 상태입니다.

- 제품 범위 고정 완료
- 요구사항/완료 기준/테스트 계획 작성 완료
- 실행 프로파일 및 상태/태스크 계약 작성 완료
- 로컬 우선 CLI와 상태 저장소 구현 완료
- blocked-safe 실행, resume, report 테스트 완료

## 문서 맵

- [spec](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/spec.md)
- [scope-freeze](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/scope-freeze.md)
- [requirements](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/requirements.yaml)
- [acceptance](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/acceptance.yaml)
- [test-plan](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/test-plan.yaml)
- [spec.yaml](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/spec.yaml)
- [implementation-spec](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/implementation-spec.md)
- [state-schema](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/state-schema.yaml)
- [task-contracts](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/task-contracts.yaml)
- [test-matrix](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/test-matrix.yaml)
- [e2e-playbook](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/e2e-playbook.md)
- [publish-policy](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/publish-policy.md)
- [repo-layout](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/repo-layout.md)

## 권장 개발 흐름

1. 로컬에서 설계 문서를 기준으로 구현한다.
2. 로컬 저장소에서 테스트와 실사용을 반복한다.
3. `.omt/`, `.env`, 로그, 회사 전용 설정은 커밋하지 않는다.
4. 공개 가능한 시점에만 공개용 브랜치 또는 정리 커밋을 만든다.
5. 그 다음에만 GitHub 원격 저장소로 선별 push 한다.

## Quick Start (V1)

```bash
npm install
npm run check
npm test
OMT_CODEX_MODEL=gpt-5.4 npm run run -- --repo-path .
npm run design -- --repo-path .
```

`OMT`가 실제 구현 작업에 사용할 모델은 `OMT_CODEX_MODEL`로 우선 지정된다. 기본 운영 기준은 `gpt-5.4`이고, 웹 예제 앱 런타임 모델은 별도로 `gpt-5-mini`를 사용한다.

## Quick Start (V2)

```bash
npm run doctor -- --repo-path /absolute/path/to/target-repo --survey-models gpt-5.2-codex --approved-models gpt-5.2-codex --execution-model gpt-5.2-codex --verifier-model gpt-5.2-codex
npm run design:v2 -- --repo-path /absolute/path/to/target-repo --survey-models gpt-5.2-codex --approved-models gpt-5.2-codex --execution-model gpt-5.2-codex --verifier-model gpt-5.2-codex
npm run run:v2 -- --repo-path /absolute/path/to/target-repo
npm run report:v2 -- --repo-path /absolute/path/to/target-repo --run-id <runId>
```

실제 회사 모델 연결 smoke가 필요하면 [docs/v2/operator-guide.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/operator-guide.md)의 `Optional Real Model Smoke`를 따른다.

브라우저 HUD로 상태를 관전하려면 아래를 추가한다.

```bash
npm run watch:v2 -- --repo-path /absolute/path/to/target-repo --port 4317
```

실행 후 브라우저에서 `http://127.0.0.1:4317`를 연다. 관전용 3터미널 예시는 [docs/v2/hud-runbook.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/v2/hud-runbook.md)에 있다.

## OMT Skill Install

다른 컴퓨터에서 Codex skill로 `OMT`를 쓰려면 이 저장소를 clone한 뒤 repo-tracked skill source를 설치한다.

```bash
git clone <repo-url>
cd oh-my-taegun
./scripts/install-codex-skill.sh omt
```

설치가 끝나면 아래처럼 정리된다.

- repo-tracked source: [`skills/omt`](/Users/ryan/Documents/AI-Project/oh-my-taegun/skills/omt)
- installed skill path: `~/.codex/skills/omt`
- 설치 방식: `~/.codex/skills/omt -> <repo>/skills/omt` symlink

즉 repo 업데이트가 곧 skill 업데이트다. clone한 저장소를 pull하면 별도 재설치 없이 최신 skill 내용이 바로 반영된다.

용어는 아래처럼 구분한다.

- `$omt`: Codex skill 호출 이름
- `omt` 또는 `npm run design:v2`: 실제 CLI 실행 경로

수동 설치가 필요하면 아래처럼 심링크를 직접 만들어도 된다.

```bash
mkdir -p ~/.codex/skills
ln -s /absolute/path/to/oh-my-taegun/skills/omt ~/.codex/skills/omt
```

설치 후 확인할 항목:

- `~/.codex/skills/omt`가 symlink인지 확인
- `~/.codex/skills/omt/SKILL.md`가 열리는지 확인
- Codex에서 `$omt` 프롬프트가 동작하는지 확인

이미 다른 `~/.codex/skills/omt`가 있다면 아래처럼 백업 후 교체할 수 있다.

```bash
./scripts/install-codex-skill.sh omt --force
```

## GitHub PR 전제 조건

- `real-pr` 모드는 GitHub 원격과 `GITHUB_TOKEN` 또는 `GH_TOKEN`이 있어야 한다.
- 토큰이 없거나 원격 push 권한이 없으면 실행은 `blocked report`로 안전 종료된다.
- 로컬 검증만 하고 싶으면 `OMT_DELIVERY_MODE=dry-run`으로 실행하면 된다.

## 공개 정책 요약

- 기본 개발은 로컬 source of truth를 사용한다.
- 원격 공개는 나중에 선별해서 수행한다.
- skill 형태 배포도 가능하지만 runtime state와 비밀값은 포함하지 않는다.
- skill wrapper를 git으로 공유하려면 repo 안의 [`skills/omt`](/Users/ryan/Documents/AI-Project/oh-my-taegun/skills/omt)를 source of truth로 사용하고, 각 컴퓨터에서는 `~/.codex/skills/omt`에 symlink 설치한다.

자세한 기준은 [publish-policy](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/publish-policy.md)를 따른다.

## 저장소 구조

현재 구조와 공개/로컬 구분 기준은 [repo-layout](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/repo-layout.md)에 정리되어 있다.

작은 검증용 앱과 fixture 기반 단계별 smoke는 [e2e-playbook](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/e2e-playbook.md)와 [`examples/chat-mini-web`](/Users/ryan/Documents/AI-Project/oh-my-taegun/examples/chat-mini-web/README.md)를 기준으로 실행한다.
