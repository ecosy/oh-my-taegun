# Chat Dogfood Playbook

`examples/chat-mini-web`는 두 층으로 나뉜다.

- `reference/`
  - 기대되는 최종 구현
- `fixture-template/`
  - `OMT`가 실제로 구현해야 하는 미완성 템플릿

`OMT` 구현 모델 기본값은 `gpt-5.4`이고, 앱 런타임 채팅 모델은 `gpt-5-mini`다.

## What This Proves

- `OMT`가 문서 기반으로 미완성 앱을 구현할 수 있는지
- `.omt/` artifact, retry, blocked, validation 흐름이 실제로 작동하는지
- 선택적으로 feature branch push와 PR delivery까지 연결되는지

## Automated Scenarios

- `chat-dogfood-ui-stream`
  - 클라이언트가 streamed token을 assistant message에 누적하는지 검증
- `chat-dogfood-server-relay`
  - Responses API 이벤트를 `token`/`done`으로 relay하는지 검증
- `chat-dogfood-error-path`
  - nested upstream error가 generic fallback 없이 드러나는지 검증
- `chat-dogfood-repair`
  - 첫 attempt 실패 후 repair retry로 수렴하는지 검증

실행:

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
npm run test:e2e
```

## Real Codex Dry-Run

`fixture-template`를 임시 git repo로 복사한 뒤, 실제 `gpt-5.4` Codex로 구현 루프를 실행한다. 기본 delivery는 `dry-run`이다.

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
OMT_CODEX_MODEL=gpt-5.4 npm run smoke:chat-dogfood:real
```

이 스크립트는 임시 repo 경로와 run 결과 JSON을 출력한다. run이 끝나면 해당 repo의 `.omt/`를 직접 확인한다.

주의:
- Codex 내부 샌드박스가 `server.listen()`을 막는 환경에서는 fixture의 server smoke가 `listen EPERM`으로 blocked 될 수 있다.
- 이 경우 스크립트 진입, prompt/result artifact 생성, 실제 `codex exec -m gpt-5.4` 호출까지는 검증된 것으로 보고, 전체 green run은 더 완화된 validation profile 또는 다른 실행 환경에서 다시 본다.

## Real PR Smoke

실제 PR smoke는 별도 원격 저장소와 GitHub 토큰이 있어야 한다.

필수 환경 변수:

- `CHAT_DOGFOOD_REMOTE`
  - 예: `https://github.com/<owner>/<repo>.git`
- `GITHUB_TOKEN` 또는 `GH_TOKEN`

선택 환경 변수:

- `CHAT_DOGFOOD_TARGET_BRANCH`
  - 기본값 `develop`
- `OMT_CODEX_MODEL`
  - 기본값 `gpt-5.4`

실행:

```bash
cd /Users/ryan/Documents/AI-Project/oh-my-taegun
CHAT_DOGFOOD_REMOTE=https://github.com/<owner>/<repo>.git \
GITHUB_TOKEN=... \
OMT_CODEX_MODEL=gpt-5.4 \
npm run smoke:chat-dogfood:pr
```

이 smoke는 임시 repo 안의 `docs/spec.yaml`을 `real-pr`로 바꾼 뒤 실행한다. direct push는 하지 않고 feature branch push와 PR 생성 경로만 사용한다.

## Passing Run Signals

- run 결과 `status`가 `completed`
- target repo `npm test` 통과
- `.omt/state/run.json` 생성
- `.omt/prompts/<run-id>/wu-*.md` 생성
- `.omt/llm-results/<run-id>/wu-*.json` 생성
- `.omt/validation/<run-id>/wu-*.json` 생성

PR smoke에서는 추가로 다음을 확인한다.

- feature branch가 원격에 push됨
- PR URL이 결과나 state에 남음
- `main`/`develop` direct push가 없음

## Failure Interpretation

- `configuration_error`
  - 키 누락, 잘못된 키, 지원되지 않는 모델
- `account_state_error`
  - quota 부족, billing 비활성
- `blocked`
  - 정책상 실행 불가, validation 실패 누적, out-of-scope 변경
- `listen EPERM`
  - Codex 실행 샌드박스가 포트 listen을 금지한 환경 제약

앱 자체의 OpenAI 실시간 데모에서 quota가 부족하면 이는 chat app 버그가 아니라 계정 상태 문제다. 반대로 dogfood E2E에서 fake Codex 기준 테스트가 실패하면 하네스 또는 fixture 설계 문제로 본다.

## Inspect

우선 확인할 파일:

- `/tmp/.../.omt/state/run.json`
- `/tmp/.../.omt/state/tasks/implement-changes.json`
- `/tmp/.../.omt/prompts/<run-id>/wu-001.md`
- `/tmp/.../.omt/llm-results/<run-id>/wu-001.json`
- `/tmp/.../.omt/validation/<run-id>/wu-001.json`
- blocked case에서는 `/tmp/.../.omt/reports/blocked-*.md`
