# chat-mini-web

가벼운 `gpt-5-mini` 텍스트 스트리밍 채팅 예제 앱과, 이를 `OMT`가 직접 구현하도록 검증하는 dogfood fixture를 함께 둔 디렉터리다.

## Layout

- `examples/chat-mini-web/`
  - 지금 바로 실행 가능한 수동 데모 앱
- `examples/chat-mini-web/reference/`
  - dogfood fixture가 최종적으로 수렴해야 하는 기준 구현
- `examples/chat-mini-web/fixture-template/`
  - `OMT`가 실제로 구현하고 검증할 대상 템플릿

## Manual Demo

```bash
cd examples/chat-mini-web
export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-5-mini
npm run dev
```

기본 모델은 `gpt-5-mini`이고, `OPENAI_MODEL`로 override할 수 있다. 실제 실행은 반드시 `process.env.OPENAI_API_KEY`가 export된 상태로 시작해야 한다. 셸 변수만 잡고 export하지 않는 방식은 사용하지 않는다.

## Manual Demo Test

```bash
cd examples/chat-mini-web
npm test
```

로컬 테스트는 `MOCK_STREAM_TEXT`를 사용해 OpenAI 호출 없이 SSE relay를 검증한다. 실제 OpenAI 계정이 quota 부족 상태면 앱은 generic 에러 대신 quota/billing 원인을 그대로 표시해야 한다.

## Dogfood Fixture

`fixture-template`는 의도적으로 미완성 상태다. 직접 `npm test`를 돌리면 실패해야 정상이다.

검증 방식은 두 가지다.

- 자동 fake Codex E2E
  - `cd /Users/ryan/Documents/AI-Project/oh-my-taegun && npm run test:e2e`
- 실제 Codex dry-run smoke
  - `cd /Users/ryan/Documents/AI-Project/oh-my-taegun && npm run smoke:chat-dogfood:real`

실제 PR smoke는 opt-in이다.

- `cd /Users/ryan/Documents/AI-Project/oh-my-taegun && CHAT_DOGFOOD_REMOTE=https://github.com/<owner>/<repo>.git GITHUB_TOKEN=... npm run smoke:chat-dogfood:pr`

자세한 운영 절차는 [docs/chat-dogfood-playbook.md](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/chat-dogfood-playbook.md)를 따른다.
