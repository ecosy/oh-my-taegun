# Implementation Spec

## 목적

- 이 문서는 현재 설계 문서 세트를 실제 구현 단위로 내리기 위한 코드 레벨 계약 문서다.
- 목표는 "질문 없이 v1 harness 골격과 핵심 흐름을 구현할 수 있는 수준"의 구조를 고정하는 것이다.

## 구현 가정

- v1 구현 언어는 TypeScript다.
- 런타임은 Node.js 22 LTS를 가정한다.
- 기본 패키지 매니저는 `npm`이다.
- Git CLI가 설치되어 있고, GitHub 또는 GitHub 호환 PR API를 우선 지원한다.
- 저장소별 build/test/deploy 명령은 실행 시 capability detection으로 발견한다.

## 구현 범위

- CLI 진입점
- 저장소 intake와 capability detection
- 낮 설계 인터뷰와 문서 freeze
- 야간 실행 오케스트레이션
- snapshot/handoff/state 저장소
- validation gate
- real PR 또는 blocked report 딜리버리

## 제외 범위

- 멀티유저 SaaS 웹 UI
- 다중 PR provider 동시 지원
- production-grade distributed queue

## 디렉토리 구조

```text
src/
  cli/
    index.ts
    commands/
      design.ts
      run.ts
      resume.ts
      report.ts
  config/
    load-profile.ts
    load-documents.ts
  intake/
    resolve-repo.ts
    detect-capabilities.ts
  design/
    interview-loop.ts
    freeze-documents.ts
    design-summary.ts
  orchestrator/
    run-engine.ts
    task-dispatcher.ts
    loop-controller.ts
    retry-policy.ts
  llm/
    types.ts
    prompt-builder.ts
    result-schema.ts
    codex-cli-adapter.ts
  planning/
    requirement-step-planner.ts
  tasks/
    repo-intake.ts
    capability-discovery.ts
    interactive-design.ts
    freeze-scope.ts
    implement-changes.ts
    run-validation.ts
    deliver-pr.ts
    summarize-outcome.ts
  state/
    state-store.ts
    snapshot-store.ts
    handoff-store.ts
    evidence-store.ts
  validation/
    traceability-gate.ts
    feature-gate.ts
    regression-gate.ts
    delivery-gate.ts
  delivery/
    git-client.ts
    pr-client.ts
    blocked-report.ts
  shared/
    types.ts
    errors.ts
    logger.ts
```

## CLI 계약

### `omt design`

- 입력:
  - `--git-url <url>` 또는 `--repo-path <path>`
  - `--profile docs/spec.yaml`
- 동작:
  - repo intake
  - capability detection
  - interactive design
  - `requirements.yaml`, `acceptance.yaml`, `test-plan.yaml`, `design_summary.md` 갱신

### `omt run`

- 입력:
  - `--profile docs/spec.yaml`
  - `--repo-path <path>` 또는 canonical workspace
- 동작:
  - 설계 완료 여부 점검
  - baseline snapshot 생성
  - nightly task flow 실행
  - PR 생성 또는 blocked report 출력

### `omt resume`

- 입력:
  - `--run-id <id>`
- 동작:
  - 최신 정상 snapshot 로드
  - handoff 주입
  - 실패 지점 이후부터 재개

### `omt report`

- 입력:
  - `--run-id <id>`
- 동작:
  - 현재 상태, AC 통과 현황, blocked 원인, PR 상태를 요약

## 핵심 타입 계약

- `RunContext`
  - `runId`
  - `profile`
  - `workspace`
  - `capabilities`
  - `deliveryPolicy`
  - `statePaths`
- `TaskResult`
  - `status`: `passed | failed | blocked`
  - `artifacts`
  - `evidenceRefs`
  - `nextActions`
  - `statePatch`
- `BlockedReason`
  - `code`
  - `message`
  - `requiredAction`
  - `evidence`
- `WorkUnit`
  - `requirementIds`
  - `acceptanceIds`
  - `testPlanIds`
  - `validationCommands`
  - `maxAttempts`
- `WorkUnitResult`
  - `status`: `changed | no_change | blocked | failed`
  - `changedFiles`
  - `suggestedValidationCommands`
  - `sessionId`

## 실행 순서

1. 문서 로드
2. repo intake
3. capability detection
4. design completion gate 확인
5. baseline snapshot 생성
6. task graph 순차 실행
   - `implement-changes`는 requirement-step planner와 Codex CLI executor를 사용한다.
   - 각 work unit 실행 뒤 targeted validation을 수행한다.
7. validation gates 실행
8. delivery 또는 blocked report
9. morning summary 출력

## 실패 모델

- task failure: 재시도 가능
- policy failure: 즉시 blocked
- credential failure: delivery blocked
- snapshot corruption: 직전 정상 snapshot으로 후퇴
- regression failure: loop 재진입 또는 blocked 종료
- llm result parse failure: 즉시 blocked
- repeated no progress: retry budget 소진 후 blocked

## 테스트 실행 계약

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:recovery`
- `npm run test:policy`

상세 케이스는 `docs/test-matrix.yaml`을 기준으로 구현한다.
