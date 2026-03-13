# E2E Playbook

`oh-my-taegun`의 현재 E2E 검증은 작은 fixture repo를 기준으로 단계별로 진행한다.

## Stages

- `example-baseline-noop`: 이미 정상인 repo를 불필요하게 수정하지 않는지 검증
- `example-basic-bugfix`: 작은 함수 버그를 수정하고 validation을 통과하는지 검증
- `example-feature-addition`: 코드와 테스트 파일을 함께 바꾸는 작은 기능 추가 검증
- `example-blocked-path`: 광범위한 수정이 발생할 때 blocked-safe로 종료하는지 검증
- `chat-dogfood-ui-stream`: chat fixture의 client stream 누적 구현 검증
- `chat-dogfood-server-relay`: chat fixture의 server token/done relay 구현 검증
- `chat-dogfood-error-path`: chat fixture의 nested upstream error surfacing 검증
- `chat-dogfood-repair`: chat fixture의 retry/repair 수렴 검증
- `llm-repair-fixture`: validation 실패 후 retry/repair가 동작하는지 검증
- `llm-fix-simple-fixture`: fake Codex 기반 기본 LLM artifact 경로 검증
- `local-run`: 로컬 repo 대상 전체 run 커맨드 출력 구조 검증

## Commands

```bash
npm run check
npm run test:e2e
```

실제 Codex 모델로 smoke를 돌릴 때는 다음 기준을 사용한다.

```bash
OMT_CODEX_MODEL=gpt-5.4 node --import tsx src/cli/index.ts run --repo-path .
```

chat dogfood 전용 smoke는 아래 스크립트로 분리했다.

```bash
npm run smoke:chat-dogfood:real
CHAT_DOGFOOD_REMOTE=https://github.com/<owner>/<repo>.git GITHUB_TOKEN=... npm run smoke:chat-dogfood:pr
```

## Inspect

각 E2E run에서는 다음 산출물을 우선 확인한다.

- `.omt/state/run.json`
- `.omt/state/tasks/implement-changes.json`
- `.omt/prompts/<run-id>/wu-001.md`
- `.omt/llm-results/<run-id>/wu-001.json`
- `.omt/validation/<run-id>/wu-001.json`
- blocked case에서는 `.omt/reports/blocked-*.md`

## Chat Example Retest

`examples/chat-mini-web`는 mock과 real OpenAI 경로를 모두 유지한다.

기본 smoke:

```bash
cd examples/chat-mini-web
npm test
```

실제 실행:

```bash
cd examples/chat-mini-web
export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-5-mini
npm run dev
```

실제 계정이 quota 부족이면 실패 원인은 generic 에러가 아니라 quota 또는 billing 문구로 그대로 보여야 한다.

## Chat Dogfood

`examples/chat-mini-web/reference/`는 기준 구현이고, `examples/chat-mini-web/fixture-template/`는 `OMT`가 구현해야 하는 미완성 템플릿이다.

- automated fake Codex coverage: `tests/e2e/chat-dogfood-*.test.ts`
- manual real Codex dry-run: `npm run smoke:chat-dogfood:real`
- opt-in real PR smoke: `npm run smoke:chat-dogfood:pr`

상세 운영 절차는 [docs/chat-dogfood-playbook.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/chat-dogfood-playbook.md)를 본다.
