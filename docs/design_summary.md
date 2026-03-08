# Design Summary

## 목표 요약

- oh-my-taegun v1의 목표는 낮 설계, 밤 자동 구현, 아침 검토 가능한 결과 전달이다.
- 현재 고정된 프로파일은 `solo operator`, `sequential execution`, `isolated worktree`, `real PR target with blocked fallback`이다.

## 4W1H 요약

### WHAT

- 문제: 장시간 무인 개발 루프를 안전하게 운영하고 아침에 실제 검토 가능한 산출물을 남겨야 한다.
- 가정: 1차 사용자는 단일 운영자이며, 다른 사용자는 clone 또는 skill로 재사용한다.
- 근거: 사용자 scope freeze 답변과 `docs/scope-freeze.md`
- 대안: 멀티유저 SaaS형 제품은 v1 범위에서 제외한다.

### WHERE

- 환경: 회사 컴퓨터의 GPT 5.2 Codex medium~xhigh 모델 환경을 기본 가정으로 둔다.
- 저장소 입력: `git URL` 또는 로컬 clone 경로
- 의존성: 저장소 stack, test/deploy 표면, secrets, 외부 시스템 연동
- 대안: repo 종류는 사전 제한하지 않되 capability detection으로 supported/partial/blocked를 판정한다.

### WHEN

- 설계 완료 시점: 더 이상 기획을 구체화하지 않아도 야간 실행이 가능한 상태
- 종료 조건: open questions 해소, MUST requirement-AC-verification 연결 완료, 승인 기록 존재
- 엣지 케이스: 정보 부족, 권한 부족, 배포/외부 write 정책 부재
- 대안: 불확실 항목은 질문 또는 blocked로 남기고 넘겨짚지 않는다.

### WHY

- 무인 실행은 질문 생략이나 자기참조적 추론이 있으면 쉽게 잘못된 구현으로 수렴한다.
- 따라서 출처 기반 설계 완료 판정, snapshot/handoff 복구, traceability gate가 필수다.
- real PR 목표 역시 검증과 정책이 닫히지 않으면 blocked fallback이 필요하다.

### HOW

- 문서 체계: `scope-freeze.md -> requirements.yaml -> acceptance.yaml -> test-plan.yaml -> spec.yaml`
- 실행 정책: sequential 기본, isolated worktree 쓰기, snapshot/handoff 기반 복구
- 딜리버리: feature 브랜치 개발 후 develop 대상 real PR, 실패 시 blocked report
- 고위험 작업: secret, production deploy, DB migration, external write, infra change는 정책 또는 승인 필요

## 요구사항 커버리지

- MUST requirement: 11개
- SHOULD requirement: 1개
- Acceptance Criteria: 10개
- Test Plan 항목: 14개
- 모든 MUST requirement는 하나 이상의 AC에 연결되고, 모든 AC는 test plan으로 내려간다.

## 리스크/불확실성

- HIGH: repo 무제한 수용 정책으로 인해 stack별 capability gap이 반드시 발생한다.
- HIGH: production deploy, secret, DB migration, external write는 승인 정책 없이 실행하면 위험하다.
- MED: real PR 목표와 엔진 기본 안전 모드 간 정책 충돌 가능성이 있다.
- 완화: capability detection, blocked fallback, sequential 기본값, delivery gate, idempotent PR 정책

## 남은 질문

- 없음

## 합의 사항

- 사용자 모드: solo
- 저장소 입력: git URL 또는 local clone path
- 야간 범위: 코드 수정, 설치, 테스트, 배포, 외부 연동 포함
- 아침 목표: feature 브랜치 구현 후 develop 대상 real PR
- 실패 fallback: blocked report 및 재시작 가능한 상태 보존
