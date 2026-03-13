# oh-my-taegun

`oh-my-taegun`은 "낮 설계 -> 밤 자동 구현 -> 아침 검토"를 목표로 하는 로컬 우선 자율 개발 하네스입니다.

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

## 빠른 시작

```bash
npm install
npm run check
npm test
npm run design -- --repo-path .
```

## GitHub PR 전제 조건

- `real-pr` 모드는 GitHub 원격과 `GITHUB_TOKEN` 또는 `GH_TOKEN`이 있어야 한다.
- 토큰이 없거나 원격 push 권한이 없으면 실행은 `blocked report`로 안전 종료된다.
- 로컬 검증만 하고 싶으면 `OMT_DELIVERY_MODE=dry-run`으로 실행하면 된다.

## 공개 정책 요약

- 기본 개발은 로컬 source of truth를 사용한다.
- 원격 공개는 나중에 선별해서 수행한다.
- skill 형태 배포도 가능하지만 runtime state와 비밀값은 포함하지 않는다.

자세한 기준은 [publish-policy](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/publish-policy.md)를 따른다.

## 저장소 구조

현재 구조와 공개/로컬 구분 기준은 [repo-layout](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/repo-layout.md)에 정리되어 있다.

작은 검증용 앱과 fixture 기반 단계별 smoke는 [e2e-playbook](/Users/ryan/Documents/AI-Project/oh-my-taegun/docs/e2e-playbook.md)와 [`examples/chat-mini-web`](/Users/ryan/Documents/AI-Project/oh-my-taegun/examples/chat-mini-web/README.md)를 기준으로 실행한다.
