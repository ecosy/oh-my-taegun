# oh-my-taegun (오 마이 퇴근!) 설계 명세서 v2

## 1. 프로젝트 개요

- **oh-my-taegun(오 마이 퇴근!)**은 "낮 설계 -> 밤 자동 구현 -> 아침 검토"를 목표로 하는 자율 개발 하네스입니다.
- Octopus의 오케스트레이션, ralph-loop의 반복 루프, Ouroboros의 수렴 판단, oh-my-codex의 메모리/상태 관리 방식을 결합하되, v1은 무인 실행 안정성과 재현 가능성에 우선순위를 둡니다.

### 1.1 목표

- 낮 시간에 설계/기획을 확정하고, 밤 사이 자동 구현/테스트/수정까지 이어간다.
- 장시간 실행 중 세션 교체, 컨텍스트 압축, 장애 복구를 통해 작업을 계속 이어갈 수 있다.
- 무한 루프를 방지하고, 수렴/회귀 판단을 통한 안전한 종료 조건을 제공한다.
- 설계 요구사항을 acceptance criteria와 실행 가능한 검증 항목으로 연결한다.

### 1.2 비목표

- 완전한 자율 제품 운영(배포/모니터링 자동화)은 1차 목표 범위에서 제외한다.
- 모델/벤더 전환 자동화는 2차 과제로 둔다.
- v1에서 다중 쓰기 태스크의 무제한 병렬 실행은 지원하지 않는다.

### 1.3 MVP 운영 원칙

- v1 기본 실행 모드는 `sequential`이다.
- 저장소를 수정하는 태스크는 격리된 작업공간 없이 병렬 실행하지 않는다.
- 원격 반영 기본값은 `dry-run` 또는 `draft-pr`이며, `push-pr`는 명시적 승인 없이는 사용하지 않는다.
- 설계 근거는 `user`, `repo`, `command`, `external` 중 출처가 남는 데이터만 인정한다.
- 시스템이 생성한 문서 텍스트는 단독 근거로 사용할 수 없다.

### 1.4 문서 체계와 Source Of Truth

- v1 문서 체계는 다음 순서를 따른다.
  - `scope-freeze.md`: 사용자 결정 고정 문서
  - `requirements.yaml`: 제품 요구사항 목록
  - `acceptance.yaml`: 요구사항별 완료 기준
  - `test-plan.yaml`: AC 검증 계획
  - `spec.yaml`: 실행 프로파일과 task 흐름
  - `design_summary.md`: 현재 설계 요약
  - `implementation-spec.md`: 구현 모듈/CLI/실행 계약
  - `state-schema.yaml`: `.omt` 상태 파일 구조
  - `task-contracts.yaml`: task type별 입출력/blocked 조건
  - `test-matrix.yaml`: 구현 테스트 스위트와 커버리지
  - `publish-policy.md`: 공개/비공개 배포 기준
  - `repo-layout.md`: 공개/로컬 디렉토리 구조 기준
- 사람이 읽는 설계 설명의 기준 문서는 `spec.md`다.
- 실행에 직접 사용되는 기준 문서는 `requirements.yaml`, `acceptance.yaml`, `test-plan.yaml`, `spec.yaml`, `state-schema.yaml`, `task-contracts.yaml`, `test-matrix.yaml`이다.
- 문서 간 충돌 시 우선순위는 `scope-freeze.md -> requirements.yaml -> acceptance.yaml -> test-plan.yaml -> spec.yaml -> implementation-spec.md -> state-schema.yaml -> task-contracts.yaml -> test-matrix.yaml -> spec.md` 순으로 해석한다.

---

## 2. 아키텍처 개요

### 2.1 핵심 구성 요소

1. **오케스트레이터**
- `spec.yaml` 기반 Task Graph 정의
- v1 기본은 순차 실행, 병렬은 읽기 전용 또는 격리된 쓰기 태스크에만 허용
- 재시도, 롤백, 잠금, 복구 지점을 관리

2. **Task 루프 엔진**
- 반복 단위: `plan -> execute -> validate -> snapshot -> continue/stop`
- 세션 길이 한도 도달 시 handoff 기반 새 세션으로 교체
- `completion_promise`와 명시적 종료 사유를 함께 기록

3. **수렴 판단기**
- raw 코드가 아니라 정규화된 작업 상태를 비교
- Acceptance Criteria 상태, failing tests, blockers, next actions를 기준으로 similarity 계산
- Stagnation, Oscillation, Repetitive feedback, Regression gate를 함께 적용

4. **메모리/상태 저장소**
- `.omt/project-memory.json`: 장기 기억
- `.omt/notepad.md`: 즉시 기록 메모
- `.omt/state/run.json`: 현재 실행 전체 상태
- `.omt/state/tasks/<task-id>.json`: 태스크별 상태
- `.omt/sessions/`: 세션 스냅샷과 요약
- `.omt/handoffs/`: 세션 교체용 handoff 문서
- `.omt/evidence.json`: 설계/검증 근거 레지스트리

5. **품질 게이트 및 딜리버리**
- Traceability gate, Validation gate, Regression gate, Delivery gate 순서로 검증
- 기본 딜리버리 모드는 `dry-run`
- `draft-pr` 및 `push-pr`는 정책과 자격증명 사전 점검 후에만 허용

6. **Task 디스패처**
- 레지스트리 기반 코어 태스크와 CLI 태스크를 모두 지원
- `type` 또는 `run`으로 실행 경로를 명시
- 공용 상태 파일의 단일 작성자 규칙을 보장

### 2.2 Task 실행 모델

- **레지스트리 방식**: `type` 값으로 내부 태스크 클래스를 매핑해 실행
- **CLI 방식**: `run` 명령을 subprocess로 실행해 결과/로그를 수집
- **규칙**: `type` 또는 `run` 중 하나만 사용한다
- **작업공간 규칙**:
  - `shared-readonly`: 공용 저장소 읽기만 가능
  - `isolated-write`: 격리된 worktree 또는 동등한 복제 작업공간에서만 쓰기 가능
- **상태 기록 규칙**:
  - 워커는 자기 태스크 상태 파일만 갱신한다
  - `.omt/state/run.json`, `.omt/project-memory.json`, `.omt/evidence.json`은 오케스트레이터만 쓴다

```yaml
execution:
  mode: sequential
  delivery_mode: dry-run
  parallel_policy:
    allow_readonly: true
    allow_isolated_write: true
    shared_write: false

tasks:
  - id: plan
    type: design_plan
    workspace_mode: shared-readonly

  - id: implement
    type: implement_feature
    workspace_mode: isolated-write
    depends_on: [plan]

  - id: report
    run: "python scripts/make_report.py --input .omt/state"
    workspace_mode: shared-readonly
    depends_on: [implement]
```

### 2.3 작업공간 격리 및 충돌 방지 규칙

- 기본 모드는 순차 실행이며, 명시적으로 허용된 경우만 병렬 실행한다.
- 저장소를 수정하는 태스크는 서로 다른 격리 worktree를 사용해야 한다.
- 공용 상태 파일은 오케스트레이터가 이벤트 로그를 병합하여 갱신한다.
- 동일 파일 집합을 수정하려는 두 태스크는 동시에 스케줄링하지 않는다.
- 격리 태스크 실패 시 변경 사항은 본 저장소에 병합하지 않고 폐기 가능해야 한다.
- 회귀 테스트와 acceptance 평가 기준은 공용 기준선(baseline)에서 비교한다.

### 2.4 설계 질문 프레임워크 (하이브리드 소크라테스)

- **질문 흐름**: WHAT -> WHERE -> WHEN -> WHY -> HOW
- **각 단계마다 4축 체크**:
  - 문제 명확화
  - 가정 점검
  - 근거 검토
  - 대안 탐색
- **적용 정책**: 리스크/불확실성이 높은 항목은 심화 질문을 추가한다.
- **완료 판정**: 필수 필드 충족 + 근거 출처 기록 + 사용자 승인

```yaml
socratic:
  what:
    problem: "해결하려는 문제"
    assumptions: ["전제/가정"]
    evidence:
      summary: "근거 요약"
      sources:
        - type: "user|repo|command|external"
          ref: "문서 경로, 명령, URL 등"
          verified_at: "ISO8601"
    alternatives: ["대안 정의"]
  where:
    problem: "실행 환경/데이터 맥락"
    assumptions: ["환경 가정"]
    evidence:
      summary: "환경 확인 근거"
      sources: []
    alternatives: ["다른 배치/환경"]
  when:
    problem: "단순 해결 vs 심층 분석 구분"
    assumptions: ["엣지 케이스 가정"]
    evidence:
      summary: "유사 사례/로그"
      sources: []
    alternatives: ["우선순위/순서 대안"]
  why:
    problem: "근본 원인 가설"
    assumptions: ["인과 가정"]
    evidence:
      summary: "증거/검증 결과"
      sources: []
    alternatives: ["다른 원인 가설"]
  how:
    problem: "최소 변경 해법"
    assumptions: ["재사용 가정"]
    evidence:
      summary: "검증 가능성"
      sources: []
    alternatives: ["더 단순한 해법"]
  open_questions: []
  risks: []
  approval:
    approved: false
    approved_by: ""
    approved_at: ""
```

### 2.5 요구사항 추적 모델 (Requirement -> AC -> Test)

- 설계 단계 종료 시 다음 산출물을 만든다.
  - `requirements.yaml`
  - `acceptance.yaml`
  - `test-plan.yaml`
  - `design_summary.md`
- 모든 `MUST` 요구사항은 최소 1개의 Acceptance Criteria(AC)에 연결되어야 한다.
- 모든 AC는 다음 중 하나에 반드시 연결되어야 한다.
  - 자동 테스트 명령
  - 수동 검증 절차
  - 외부 시스템 의존으로 인한 보류 사유
- 모든 AC는 최소 1개의 `test-plan.yaml` 항목에 연결되어야 한다.
- 수동 검증은 사용자 승인과 검증 책임자 표시 없이는 완료로 간주하지 않는다.
- 야간 실행은 `MUST requirement -> AC -> verification` 연결이 하나라도 비어 있으면 시작하지 않는다.

```yaml
requirements:
  - id: REQ-1
    priority: MUST
    description: "사용자가 기능 X를 실행할 수 있어야 한다"
    source_refs: ["user:interview-2026-03-08"]

acceptance_criteria:
  - id: AC-1
    requirement_ids: ["REQ-1"]
    description: "명령 A 실행 시 결과 B가 출력된다"
    verification:
      type: automated
      command: "pnpm test -- --runInBand feature-x"

test_plan:
  - id: TP-1
    acceptance_ids: ["AC-1"]
    stage: regression
    command: "pnpm test -- --runInBand feature-x"
```

### 2.6 설계 산출물 포맷 (design_summary.md)

- **목적**: 설계 결정, 리스크, 미해결 쟁점, 검증 계획을 한 장에 요약
- **생성 시점**: `socratic.completed=true` 직후 자동 생성
- **필수 항목**:
  - 목표 요약
  - 4W1H 요약
  - 핵심 리스크와 완화책
  - 요구사항/AC/검증 커버리지 요약
  - 남은 질문
  - 승인 정보

```markdown
# Design Summary

## 목표 요약
- 핵심 문제/성공 기준
- 입력/출력

## 4W1H 요약
### WHAT
- 문제/가정/근거/대안 요약
### WHERE
- 환경/데이터/의존성 요약
### WHEN
- 우선순위/엣지 케이스 요약
### WHY
- 근본 원인/근거 요약
### HOW
- 최소 변경 해법/대안 비교 요약

## 요구사항 커버리지
- MUST requirement 수
- AC 연결률
- 자동 검증 가능 비율

## 리스크/불확실성
- HIGH/MED/LOW 분류와 완화책

## 남은 질문
- open_questions 목록

## 합의 사항
- 승인자/시각/합의 범위
```

### 2.7 리스크/불확실성 판단 규칙

- **HIGH 트리거(심화 질문 필수)**:
  - 성공 기준, 입출력, DoD 중 하나라도 공백
  - 실행 환경(OS/권한/네트워크) 정보 부재
  - 세션 복구 전략 미정
  - `MUST requirement -> AC -> verification` 연결 누락
  - `AC -> test-plan` 연결 누락
  - 외부 의존성(LLM, PR, 원격 저장소) 실패 시 대응 미정
  - 보안, 비용, 데이터 민감도 의사결정 누락
- **MED 트리거(추가 질문 권장)**:
  - 대안이 1개 이하로만 제시됨
  - 근거가 경험/추정에 치우침
  - 엣지 케이스가 1개 미만
  - delivery mode가 `draft-pr` 이상인데 자격증명/보호 브랜치 정책이 불명확함
- **LOW**:
  - 4W1H 모든 축이 근거/대안 포함으로 충족
  - 테스트, 실행, 롤백, 복구 계획이 명확

### 2.8 단계별 질문 템플릿(요약)

- **WHAT**
  - 문제: "진짜 해결하려는 문제는 무엇인가?"
  - 가정: "당연하다고 여긴 전제는?"
  - 근거: "이를 뒷받침하는 데이터/로그는?"
  - 대안: "문제를 다르게 정의할 수 있는가?"
- **WHERE**
  - 문제: "실행 환경/데이터 흐름의 핵심은?"
  - 가정: "환경/권한을 추정하지 않았는가?"
  - 근거: "환경 정보를 어디서 확인했는가?"
  - 대안: "다른 배치/환경에서도 가능한가?"
- **WHEN**
  - 문제: "단순 해결로 충분한가, 심층 분석이 필요한가?"
  - 가정: "엣지 케이스를 과소평가하지 않았나?"
  - 근거: "유사 사례/로그가 있는가?"
  - 대안: "다른 우선순위/순서가 가능한가?"
- **WHY**
  - 문제: "근본 원인은 무엇이라고 보는가?"
  - 가정: "인과를 추정한 부분은?"
  - 근거: "증명 가능한 근거는?"
  - 대안: "다른 원인 가설은?"
- **HOW**
  - 문제: "최소 변경으로 해결 가능한가?"
  - 가정: "재사용 가능한 자산을 과소평가하지 않았나?"
  - 근거: "검증 가능한 실행 계획인가?"
  - 대안: "더 단순한 해결책은 없는가?"

### 2.9 design_summary.md 자동 생성 규칙

- 각 단계(WHAT~HOW)당 최대 3줄로 요약한다.
- 우선순위는 `문제/성공 기준 -> 리스크 -> 검증 계획 -> 대안` 순으로 둔다.
- 근거는 항상 출처를 함께 기록한다.
- 리스크는 개수와 핵심 1~2개만 요약한다.
- 요구사항 커버리지는 `요구사항 수`, `AC 연결률`, `자동 검증 가능 비율`을 포함한다.
- 생성 실패 시 실패 원인과 원본 섹션 링크를 기록한다.

### 2.10 socratic.completed 판정 로직

- **필수 충족 조건**
  - WHAT~HOW 모든 단계에서 `problem`, `evidence.summary`, `alternatives`가 비어 있지 않음
  - `assumptions`는 각 단계마다 최소 1개 이상
  - 각 단계의 `evidence.sources`가 최소 1개 이상
  - `open_questions`가 비어 있음
  - `approval.approved=true`
  - 모든 `MUST` 요구사항이 AC와 검증 항목에 연결됨
  - 모든 AC가 `test-plan.yaml`에 연결됨
- **리스크 조건**
  - HIGH 리스크는 `mitigation`이 비어 있지 않아야 함
  - HIGH 리스크가 남아 있으면 `accepted=true` 또는 사용자 승인 메모 필수
- **자동 채움 허용 범위**
  - 자동 채움은 `user`, `repo`, `command`, `external` 출처로 역추적 가능한 경우에만 허용
  - 시스템이 생성한 spec 본문, summary, handoff는 단독 근거로 사용할 수 없음
  - 자동 채움 시 `evidence.summary`에 `auto-infer`를 표기하고 원본 `source_ref`를 남김
- **판정 결과**
  - 위 조건 충족 -> `completed=true`
  - 하나라도 누락 -> `completed=false` 및 추가 질문 생성

### 2.11 질문 자동 생성 규칙

- 2.8 질문 세트를 기본 템플릿으로 사용한다.
- `problem`, `evidence`, `alternatives`가 비면 우선 질문한다.
- `assumptions`가 0개면 암묵적 가정 질문을 추가한다.
- HIGH 트리거 시 근거와 대안을 각각 2개 이상 확보할 때까지 심화 질문을 이어간다.
- 동일 질문이 2회 이상 반복되면 형태를 바꿔 재질문한다.
- 같은 답이 반복되면 근거 요청 형태로 전환한다.
- `socratic.completed=true` 또는 사용자 승인으로 리스크 수용 시 종료한다.

---

## 3. 실행 흐름

### 3.1 설계 단계 (낮)

- 하이브리드 소크라테스 질문으로 요구사항을 수집한다.
- 저장소 구조, 실행 환경, 기존 테스트를 실제 명령으로 점검해 근거를 보강한다.
- `requirements.yaml`, `acceptance.yaml`, `test-plan.yaml`, `spec.yaml`, `design_summary.md`를 생성한다.
- Definition of Done은 "모든 MUST AC 통과 + 필수 품질 게이트 통과 + 남은 HIGH 리스크 처리"로 정의한다.
- 근거 출처나 요구사항 추적이 비어 있으면 실행 단계로 넘어가지 않는다.

### 3.2 실행 단계 (밤)

1. 실행 전 `delivery_mode`, 자격증명, 보호 브랜치 정책, baseline 테스트를 점검한다.
2. `run_id`를 발급하고 baseline snapshot과 작업 브랜치/작업공간을 만든다.
3. 기본은 순차 실행으로 태스크를 수행한다.
4. 각 반복마다 구현, 검증, snapshot, handoff, evidence delta 업데이트를 수행한다.
5. 세션 길이 한도에 도달하면 최신 handoff로 새 세션을 시작한다.
6. Traceability gate -> Validation gate -> Regression gate -> Delivery gate 순으로 검사한다.
7. `delivery_mode`에 따라 dry-run 보고서 생성, draft PR 생성, 또는 승인된 push/PR를 수행한다.
8. 완료 또는 중단 시 아침 보고서용 결과물을 남긴다.

### 3.3 결과 단계 (아침)

- PR 링크 또는 dry-run 결과를 제공한다.
- 변경 요약, AC 통과 현황, 실패/보류 항목, 수렴 판단 근거를 보고한다.
- 마지막 성공 snapshot과 재시작 지점을 기록한다.

### 3.4 현재 v1 운영 프로파일

- 현재 고정된 프로파일은 `solo operator + sequential execution + isolated worktree + real PR target`이다.
- 엔진의 기본 안전 모드는 `dry-run`이지만, 현재 프로파일은 명시적 제품 목표로 `real PR`을 사용한다.
- 단, `real PR`은 capability detection, feature validation, regression validation, delivery policy가 모두 통과했을 때만 허용된다.
- 위 조건을 충족하지 못하면 결과는 `blocked report`로 전환된다.

---

## 4. 루프/종료 조건 상세

### 4.1 기본 반복

- 현재 미해결 AC와 blockers를 기준으로 다음 액션을 계획한다.
- 최소 변경 단위로 구현하고 즉시 검증한다.
- 반복 종료 전 snapshot과 handoff를 기록한다.
- 미해결 AC가 남아 있고 종료 조건에 도달하지 않았을 때만 다음 반복으로 진행한다.

### 4.2 세션 지속성 및 복구

- 각 반복 종료 시 snapshot을 기록한다.
- 세션 교체 직전에는 반드시 handoff를 생성한다.
- snapshot에는 최소 다음 정보를 담는다.
  - `run_id`, `iteration`
  - 현재 브랜치/작업공간 정보
  - 완료/미완료 AC 목록
  - failing tests
  - changed files
  - blockers
  - 다음 액션 요약
  - 마지막 검증 결과
- 프로세스 중단 시 가장 최근의 정상 snapshot에서 복구를 시작한다.
- snapshot 손상 시 직전 정상 snapshot으로 후퇴하고, 둘 다 손상되면 안전 중단한다.

### 4.3 수렴 조건(보수적 모드)

- **정규화 상태 벡터**
  - `ac_status`: AC별 `pass|fail|blocked`
  - `failing_tests`: 현재 실패 테스트 집합
  - `blockers`: 미해결 이슈 집합
  - `next_actions`: 다음 반복 계획 요약
- **Similarity 계산**
  - `0.4 * ac_status_similarity`
  - `0.3 * failing_tests_similarity`
  - `0.2 * blockers_similarity`
  - `0.1 * next_actions_similarity`
- **수렴 판정**
  - similarity >= 0.95가 3회 연속 유지
  - 모든 MUST AC가 `pass` 또는 승인된 `blocked`
  - Validation gate와 Regression gate 통과
  - 새로운 failing test가 발생하지 않음
- **병리 패턴 감지**
  - Stagnation: 3회 연속 상태 벡터 변화가 거의 없음
  - Oscillation: `N`과 `N-2` 상태가 반복됨
  - Repetitive feedback: 같은 미해결 질문/실패 원인 비중이 70% 이상
  - Regression gate: 기존 통과 AC 또는 baseline 테스트가 깨지면 수렴 차단

### 4.4 실패/중단 규칙

- `max_iterations` 또는 `max_runtime` 초과 시 중단
- snapshot/state 파일 손상 시 안전 중단
- 동일한 실행 계획이 3회 이상 반복되면 중단 후 원인 보고
- 테스트 실패가 지속되고 변화가 없으면 중단 후 blocked 상태로 남김
- 딜리버리 실패는 구현 산출물을 폐기하지 않고 `delivery_status=blocked`로 기록한다

---

## 5. 컨텍스트/메모리 정책

### 5.1 파일 저장소

- `.omt/project-memory.json`
  - 장기 학습 결과, 패턴, 반복 리스크
- `.omt/notepad.md`
  - 즉시 발견된 이슈와 다음 액션 메모
- `.omt/state/run.json`
  - 현재 실행의 메타 상태, 게이트 통과 여부, delivery 상태
- `.omt/state/tasks/<task-id>.json`
  - 태스크별 진행 상황, 로그 요약, 재시도 횟수
- `.omt/sessions/<run-id>/snapshot-<n>.json`
  - 반복별 스냅샷
- `.omt/handoffs/<run-id>/handoff-<n>.md`
  - 세션 교체용 요약 문서
- `.omt/evidence.json`
  - 설계/검증 근거와 출처 레지스트리

### 5.2 컨텍스트 압축 규칙

- 오래된 상세 로그는 요약 후 snapshot 참조로 대체한다.
- handoff에는 안정된 사실과 현재 델타만 남긴다.
- 설계 근거, 실패 테스트, 미해결 AC는 압축 과정에서 절대 삭제하지 않는다.
- 요약 결과만으로 판단하기 어려운 경우 원본 snapshot 참조를 유지한다.

### 5.3 Handoff 흐름

- 각 태스크 완료 또는 세션 교체 시 handoff를 생성한다.
- handoff는 다음 항목을 포함한다.
  - 목표와 현재 상태
  - 최근 변경 파일
  - 통과/실패 테스트
  - 미해결 AC와 blockers
  - 다음 액션
  - 관련 evidence ref
- 다음 세션은 handoff와 최신 snapshot을 함께 주입받는다.

### 5.4 재시작 복구 절차

- 가장 최근의 정상 snapshot을 로드한다.
- 현재 브랜치, 작업공간, baseline commit을 검증한다.
- 최신 handoff와 미해결 AC를 바탕으로 루프를 재개한다.
- 브랜치나 작업공간이 사라졌으면 새 격리 작업공간을 만들고 blocked 리포트를 남긴다.

---

## 6. 품질 게이트 및 자동 PR

### 6.1 품질 게이트

- **Traceability gate**
  - 모든 MUST requirement가 AC에 연결되었는지 확인
  - 모든 AC가 자동 또는 수동 검증 방법을 가지는지 확인
- **Validation gate**
  - 단위 테스트, 회귀 테스트, 린트, 타입체크, 필요한 통합 테스트 수행
- **Regression gate**
  - baseline 대비 기존 통과 기능이 깨지지 않았는지 확인
- **Delivery gate**
  - 작업 브랜치 상태, 변경 요약, commit 가능 상태, 남은 HIGH 리스크를 점검
- 하나라도 실패하면 자동 수정 루프 재진입 또는 blocked 종료를 수행한다.

### 6.2 자동 커밋/PR/푸시 정책

- **딜리버리 모드**
  - `dry-run`: 로컬 결과물과 보고서만 생성
  - `draft-pr`: 원격 브랜치 푸시 + draft PR 생성
  - `push-pr`: 승인된 정책 하에 원격 브랜치 푸시 + PR 생성/업데이트
- **기본값**
  - v1 기본은 `dry-run`
  - `draft-pr` 이상은 사용자 승인, 자격증명, 보호 브랜치 정책 확인 후에만 허용
- **현재 프로파일 해석**
  - `docs/spec.yaml`의 `omt-v1-solo-real-pr` 프로파일은 목표 딜리버리를 `real-pr`로 둔다.
  - 이는 엔진 기본값을 바꾸는 것이 아니라, 필요한 정책/검증을 모두 통과했을 때 적용되는 실행 프로파일이다.
  - 정책 미충족 시 `real-pr` 대신 `blocked report`로 종료한다.
- **안전장치**
  - 보호 브랜치에는 직접 푸시하지 않는다
  - 생성 브랜치에만 푸시한다
  - `run_id`를 idempotency key로 사용해 재실행 시 기존 브랜치/PR을 재사용한다
  - 기존 PR이 있으면 새 PR을 만들지 않고 업데이트한다
  - 원격 실패 시 로컬 커밋/변경은 유지하고 `delivery_status=blocked`로 기록한다
  - 자격증명 점검 실패 시 push 단계를 건너뛰고 dry-run 보고서로 대체한다

---

## 7. 리스크 및 세이프가드

- 무한 루프 방지: `max_iterations`, `max_runtime`, 수렴 기준, 반복 계획 감지
- 회귀 차단: Regression gate와 baseline 비교
- 컨텍스트 유실 방지: snapshot, handoff, evidence registry, 단일 작성자 상태 규칙
- 설계 누락 방지: Requirement -> AC -> Test 추적 강제
- 저장소 충돌 방지: 기본 순차 실행, 격리 worktree, 공용 상태 잠금
- 원격 반영 사고 방지: `dry-run` 기본값, 보호 브랜치 회피, idempotent 딜리버리

---

## 8. 테스트/검증 항목

- `socratic.completed=true`가 아니면 실행이 차단되는지
- 모든 MUST requirement가 AC와 검증 항목에 연결되는지
- 모든 AC가 `test-plan.yaml`에 연결되는지
- 자동 채움 근거가 실제 출처를 갖고 있고 자기참조를 허용하지 않는지
- snapshot/handoff 기반 재시작이 정상 동작하는지
- snapshot 손상 시 직전 정상 snapshot으로 복구되는지
- 기본 순차 실행에서 안정적으로 동작하는지
- 병렬 읽기 전용 태스크와 격리 쓰기 태스크가 충돌 없이 동작하는지
- 수렴 기준이 AC 상태, failing tests, blockers 변화에 따라 정상 동작하는지
- 회귀 발생 시 수렴이 차단되는지
- Traceability gate, Validation gate, Regression gate, Delivery gate가 순서대로 적용되는지
- `dry-run`, `draft-pr`, `push-pr` 모드가 정책대로 분기되는지
- 재실행 시 같은 `run_id`로 기존 브랜치/PR을 재사용하는지
- protected branch 환경에서 직접 푸시가 차단되는지

---

## 9. 요약

oh-my-taegun v2는 "밤새 자동 개발" 자체보다 "밤새 멈추지 않고, 아침에 검토 가능한 결과를 남기는 것"을 우선하는 설계다. 핵심은 순차 실행 기본값, 세션 snapshot/handoff 복구, Requirement -> AC -> Test 추적, 정규화 상태 기반 수렴 판정, 그리고 엔진 기본 안전 모드 위에 `real PR` 목표 프로파일을 올린 보수적 딜리버리 정책이다.
