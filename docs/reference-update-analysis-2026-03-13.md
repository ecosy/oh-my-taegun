# OMT 레퍼런스 저장소 최신화 분석

작성일: 2026-03-13

## 1. 조사 기준과 출처

### 조사 기준

- 범위는 초기 기획 문서에 명시된 두 저장소로 고정했다.
  - `Q00/ouroboros`
  - `Yeachan-Heo/oh-my-codex`
- 외부 기준선은 각 저장소의 `main` 브랜치 기준 `README`, `CHANGELOG`, 최신 커밋을 사용했다.
- 내부 기준선은 OMT의 현재 문서와 구현을 사용했다.
  - `README.md`
  - `docs/spec.md`
  - `docs/spec.yaml`
  - `docs/implementation-spec.md`
  - `src/orchestrator/*`
  - `src/llm/*`
  - `src/state/*`
  - `src/tasks/*`

### 외부 출처

- `Ouroboros`
  - [README](https://github.com/Q00/ouroboros/blob/main/README.md)
  - [CHANGELOG](https://github.com/Q00/ouroboros/blob/main/CHANGELOG.md)
  - [latest inspected commit `ef22638`](https://github.com/Q00/ouroboros/commit/ef22638)
- `oh-my-codex`
  - [README](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/README.md)
  - [CHANGELOG](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/CHANGELOG.md)
  - [latest inspected commit `be85d13`](https://github.com/Yeachan-Heo/oh-my-codex/commit/be85d13)

### 내부 출처

- [초기기획](./초기기획.md)
- [설계 명세](./spec.md)
- [실행 프로파일](./spec.yaml)
- [구현 계약](./implementation-spec.md)
- [README](../README.md)
- [run-engine](../src/orchestrator/run-engine.ts)
- [loop-controller](../src/orchestrator/loop-controller.ts)
- [detect-capabilities](../src/intake/detect-capabilities.ts)
- [codex-cli-adapter](../src/llm/codex-cli-adapter.ts)
- [llm types](../src/llm/types.ts)
- [state-store](../src/state/state-store.ts)
- [snapshot-store](../src/state/snapshot-store.ts)
- [resume command](../src/cli/commands/resume.ts)
- [report command](../src/cli/commands/report.ts)
- [delivery gate](../src/validation/delivery-gate.ts)
- [traceability gate](../src/validation/traceability-gate.ts)

### 해석 원칙

- OMT 도입 판단은 "OMT v1 단일 운영자, 순차 실행, blocked-safe" 원칙을 우선했다.
- `Ouroboros`의 경우 `CHANGELOG`의 릴리즈 순서가 현재 `main` 설명과 완전히 일치하지 않아, 도입 판단은 태그 순서보다 `main` 브랜치 문서와 최근 커밋에 더 무게를 두었다.
- `oh-my-codex`는 `v0.8.x`부터 `v0.9.1`까지 changelog가 비교적 명확하므로 릴리즈 단위 변화도 함께 반영했다.

## 2. 저장소별 최신 변화 요약

### 2.1 `Q00/ouroboros`

#### 현재 포지셔닝 변화

초기 참고 시점의 OMT는 `Ouroboros`에서 "질문 기반 설계 수렴", "수렴 판단", "Ralph형 반복 루프" 개념을 가져왔다. 현재 `Ouroboros`는 단순한 루프 하네스보다 더 명확한 "specification-first AI development system"으로 포지셔닝이 이동했다. 인터뷰, 시드, 실행, 평가를 별개 단계로 고정하고, 모호성 점수와 수렴 공식을 전면에 내세운다. 출처: [README](https://github.com/Q00/ouroboros/blob/main/README.md)

#### 구조적 변화

- 인터뷰 종료 조건이 감각적 종료가 아니라 수치 기반 게이트로 더 명확해졌다.
  - `Ambiguity <= 0.2`
  - `Similarity >= 0.95`
  - stagnation, oscillation, repetitive feedback, hard cap 감지
  - 출처: [README](https://github.com/Q00/ouroboros/blob/main/README.md)
- 런타임 상태 관리의 중심이 파일형 `StateStore` 계열이 아니라 `EventStore/SQLite` 쪽으로 이동했다.
  - changelog의 `Unreleased` 섹션은 `StateStore`, `StateManager`, `RecoveryManager`, `StateCompression` 제거와 EventStore/SQLite 중심 관리를 명시한다.
  - 출처: [CHANGELOG](https://github.com/Q00/ouroboros/blob/main/CHANGELOG.md)
- 단일 루프보다 플러그인 기반 orchestration 프레임워크 쪽으로 확장되었다.
  - `AgentRegistry`, `AgentPool`, `SkillRegistry`, `ModelRouter`, `Scheduler`
  - 역할별 builtin agent와 skill hot-reload 구조가 추가되었다.
  - 출처: [CHANGELOG](https://github.com/Q00/ouroboros/blob/main/CHANGELOG.md)
- MCP 경로와 서버 초기화 안정화가 주요 유지보수 축으로 보인다.
  - `0.13.2`~`0.13.4`, `0.14.1`에 MCP 초기화, 에러 응답, validation, CLI wiring 관련 수정이 집중되어 있다.
  - 출처: [CHANGELOG](https://github.com/Q00/ouroboros/blob/main/CHANGELOG.md)
- HUD/TUI와 온보딩 문서가 강화되었다.
  - `AgentsPanel`, `TokenTracker`, `EventLog`, `HUDDashboard`, tutorial flow 추가
  - 출처: [CHANGELOG](https://github.com/Q00/ouroboros/blob/main/CHANGELOG.md)

#### OMT에 중요한 함의

- OMT가 이미 채택한 "질문 -> 설계 -> 구현 -> 검증" 방향은 맞다.
- 그러나 OMT의 현재 수렴 판정은 문서 추적성과 테스트 통과 중심이고, 설계 모호성 점수화나 반복 병리 진단은 거의 없다.
- EventStore/SQLite 전환은 장기적으로 유효하지만, 현재 OMT의 단순 JSON 상태 구조를 당장 대체할 만큼 v1 핵심 요구는 아니다.

### 2.2 `Yeachan-Heo/oh-my-codex`

#### 현재 포지셔닝 변화

초기 참고 시점의 OMT는 `oh-my-codex`에서 "메모리/상태 관리"와 "Codex 기반 장시간 실행" 방향을 가져왔다. 현재 `oh-my-codex`는 단순 Codex wrapper가 아니라 "Codex를 실행 엔진으로 두고 그 위에 operational runtime을 얹는 시스템"으로 정체성이 분명해졌다. 특히 `Team Mode first`가 핵심이다. 출처: [README](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/README.md)

#### 구조적 변화

- Team Mode가 제품 중심축으로 강화되었다.
  - 리더/워커 역할 분리, team API, idle/stall 감시, conservative rebalance, await/event query, linked Ralph lifecycle이 릴리즈 전반에 걸쳐 추가되었다.
  - 출처: [CHANGELOG](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/CHANGELOG.md)
- 운영자 제어면이 크게 넓어졌다.
  - `omx team status`, `resume`, `shutdown`, `doctor`, `hud`, `ask`, `team api`
  - 세션/런타임 관찰과 제어가 명시적 CLI 표면으로 승격되었다.
  - 출처: [README](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/README.md)
- 안전한 read-only 탐색 경로가 별도 제품 기능으로 분리되었다.
  - `omx explore`와 `omx sparkshell`은 허용된 읽기 전용 명령군만 사용하는 탐색 fast path다.
  - allowlist, fallback, hydration, native asset 배포 전략이 문서화되어 있다.
  - 출처: [README](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/README.md), [CHANGELOG](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/CHANGELOG.md)
- 프롬프트 계약과 모델 기본값이 중앙화되었다.
  - `DEFAULT_FRONTIER_MODEL`, `DEFAULT_SPARK_MODEL`, role/prompt contract, posture-aware routing, prompt XML normalization
  - 출처: [CHANGELOG](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/CHANGELOG.md)
- 설치/운영 진단과 릴리즈 안정화가 꾸준히 강화되었다.
  - `doctor`, setup refresh, bin contract tests, packed-install smoke, release hydration, native manifest 검증
  - 출처: [CHANGELOG](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/CHANGELOG.md)

#### OMT에 중요한 함의

- OMT가 장기 실행을 실제 운영 도구로 만들려면 "실행"보다 "관찰, 진단, 복구" 표면이 더 필요하다.
- 반면 Team Mode, tmux 기반 다중 워커, native Rust 사이드카는 OMT v1의 순차 단일 운영자 원칙과 거리가 있다.
- `omx explore`류의 제한된 read-only 탐색은 OMT capability detection과 사전 조사 단계에 비교적 낮은 비용으로 흡수할 수 있다.

## 3. OMT 대비 갭 분석 표

| 비교 축 | `Ouroboros` 최신 상태 | `oh-my-codex` 최신 상태 | OMT 현재 상태 | OMT 매핑 | 판단 |
| --- | --- | --- | --- | --- | --- |
| 1. 설계 수렴 방식 | ambiguity/similarity 수식과 병리 탐지 | prompt contract 강화, direct execution bias | 설계 문서/traceability 중심, 정량적 ambiguity 없음 | 부분적으로 있음 | `Ouroboros`식 정량 게이트 일부 도입 가치가 높다 |
| 2. 장기 실행 상태 관리 | EventStore/SQLite 중심 | MCP-backed runtime state, mailbox, diagnostics | `.omt/state/*.json`, `.omt/sessions/*`, `.omt/handoffs/*` 파일 기반 | 방향은 같지만 구현 방식이 다름 | append-only 이벤트 로그 보강은 유효, 전면 교체는 시기상조 |
| 3. 세션 교체와 resume | Ralph/EventStore 기반 지속 루프 | `omx resume`, team resume, linked lifecycle | `resume`는 최신 snapshot/handoff를 출력만 함 | 부분적으로 있음 | 실제 재개 제어면이 빈약하다 |
| 4. 병렬/팀 오케스트레이션 | AgentPool/Scheduler | Team Mode, rebalance, team api | `execution.mode: sequential`, 단일 executor | v1 철학과 충돌함 | v2 후보로만 유지 |
| 5. 검증 게이트와 완료 판정 | mechanical/semantic/consensus 평가 강조 | 팀 런타임/verification guidance 강화 | traceability + feature/regression + delivery gate | 부분적으로 있음 | semantic gate보다 no-progress/oscillation 계측이 먼저다 |
| 6. 모델/역할 라우팅 | ModelRouter, builtin agents | centralized defaults, posture-aware routing | 단일 `gpt-5.4`, 단일 executor, role 없음 | 없음 | 단일 실행자 기준의 최소 라우팅 계약은 바로 가치가 있다 |
| 7. 운영자 관측성 | TUI HUD, token tracker, event log | HUD, status, doctor, team api | `report`는 JSON 요약만 제공 | 없음 | `doctor`와 richer report가 우선 |
| 8. 안전한 read-only 조사 경로 | 연구자/분석자 에이전트는 있으나 별도 탐색 하네스는 문서상 약함 | `omx explore`/`sparkshell`로 명시적 제품화 | `detectCapabilities()`는 `package.json`/lockfile 중심 정적 스캔 | 없음 | 낮은 비용 대비 개선 효과가 크다 |
| 9. 설치/환경 진단 | setup/tutorial 강화 | `doctor`, setup refresh, packed-install smoke | 사전 점검은 delivery gate 일부뿐 | 없음 | 즉시 적용 가치가 높다 |
| 10. 배포/릴리즈 안정화 | MCP/CLI 안정화 위주 | release hydration, bin contract, smoke gating | OMT 자체 릴리즈 하네스는 아직 얕음 | 없음 | 현재는 런타임 진단 강화가 릴리즈 체계보다 우선 |

## 4. 적용 추천안 Top 6

### 4.1 추천안 A: `omt doctor`와 실행 전 preflight 진단 도입

- 항목명: 진단 커맨드와 사전 점검 표면
- 출처 저장소 / 버전 또는 커밋:
  - `oh-my-codex` README의 `omx doctor`
  - `oh-my-codex` `0.8.x`~`0.9.1`의 setup/runtime/release hardening
- OMT 현재 상태:
  - capability detection은 `package.json`, lockfile, `.env.example` 수준의 얕은 정적 스캔이다.
  - delivery gate는 토큰, 브랜치, origin URL 정도만 확인한다.
  - 출처: [detect-capabilities](../src/intake/detect-capabilities.ts), [delivery gate](../src/validation/delivery-gate.ts)
- 적용 가치:
  - 높음
  - blocked-safe 철학과 직접 정렬된다.
  - 실패를 야간 중간이 아니라 실행 전으로 당길 수 있다.
- 영향 범위:
  - `src/cli/index.ts`
  - `src/cli/commands/doctor.ts` 신규
  - `src/intake/detect-capabilities.ts`
  - `src/validation/delivery-gate.ts`
  - `docs/spec.yaml`
- 난이도: 낮음
- 우선순위: P1
- 권장 여부: 즉시 적용 권장
- 왜 필요한지:
  - 현재 OMT는 "지원 가능한 저장소인지", "필수 명령이 실제로 실행 가능한지", "GitHub push/PR 자격이 되는지"를 충분히 미리 확인하지 않는다.
- 기대 효과:
  - blocked run 감소
  - 실제 야간 성공률 상승
  - 문제 원인 분리 개선
- 리스크:
  - 과도한 진단으로 false negative가 나올 수 있다.
- 선행 조건:
  - 없음
- 적용 순서:
  1. `doctor` 커맨드 추가
  2. capability detection 확장
  3. `run` 시작 전 preflight 요약 출력 또는 실패 처리
- 비고:
  - OMT v1 원칙과 가장 잘 맞는 외부 변화다.

### 4.2 추천안 B: 모델 기본값과 실행 계약의 중앙화

- 항목명: 단일 실행자용 model/runtime contract 정리
- 출처 저장소 / 버전 또는 커밋:
  - `oh-my-codex` `0.8.11`, `0.8.5`, `0.8.7`
  - `Ouroboros` `ModelRouter`/execution mode 확장
- OMT 현재 상태:
  - `spec.yaml`, 환경변수, `resolveLlmRuntimeSettings()`, `codex-cli-adapter`가 모델/실행 계약을 나눠 들고 있다.
  - 실질적으로는 단일 `gpt-5.4` 고정에 가깝고 역할별 차등이 없다.
  - 출처: [spec.yaml](./spec.yaml), [llm types](../src/llm/types.ts), [codex-cli-adapter](../src/llm/codex-cli-adapter.ts)
- 적용 가치:
  - 높음
  - 복잡한 team routing 없이도 일관성 개선 효과가 있다.
- 영향 범위:
  - `src/llm/types.ts`
  - `src/llm/codex-cli-adapter.ts`
  - `src/llm/prompt-builder.ts`
  - `docs/spec.yaml`
- 난이도: 낮음
- 우선순위: P1
- 권장 여부: 즉시 적용 권장
- 왜 필요한지:
  - 현재는 프로파일 문서와 실제 실행 시점 env override가 느슨하게 연결되어 있어 재현성이 약하다.
- 기대 효과:
  - 재현 가능성 향상
  - 실행 로그와 문서 사이의 계약 일치
  - 향후 verifier/research 모드 추가 시 확장 용이
- 리스크:
  - 과도한 추상화로 v1 단순성을 해칠 수 있다.
- 선행 조건:
  - 없음
- 적용 순서:
  1. canonical model/default resolution 한 곳으로 통합
  2. work-unit prompt에 runtime contract 명시
  3. report/artefact에 실행 계약 기록
- 비고:
  - 다중 agent routing까지 갈 필요는 없다. 단일 executor 기준의 명시적 계약만 먼저 가져오면 된다.

### 4.3 추천안 C: 제한된 read-only 탐색 경로 추가

- 항목명: 안전한 사전 조사 하네스
- 출처 저장소 / 버전 또는 커밋:
  - `oh-my-codex` `0.9.0`, `0.9.1`
  - `omx explore`, `omx sparkshell`
- OMT 현재 상태:
  - capability detection은 스크립트/파일 존재 여부를 읽는 수준이다.
  - 실제 저장소의 테스트 표면, 배포 표면, 외부 write 표면을 안전하게 조사하는 실행 모드가 없다.
  - 출처: [detect-capabilities](../src/intake/detect-capabilities.ts)
- 적용 가치:
  - 높음
  - 구현 루프 이전의 불확실성을 가장 저렴하게 줄일 수 있다.
- 영향 범위:
  - `src/intake/detect-capabilities.ts`
  - `src/shared/command.ts`
  - `src/tasks/repo-intake.ts`
  - `docs/spec.yaml`
  - 선택적으로 `omt inspect` 또는 `omt run --preflight-only`
- 난이도: 중간
- 우선순위: P1
- 권장 여부: 즉시 적용 권장
- 왜 필요한지:
  - 현재 OMT는 "읽어서 추정"은 하지만 "안전하게 실행해서 확인"은 거의 하지 않는다.
- 기대 효과:
  - capability 분류 정확도 상승
  - blocked reason 품질 향상
  - 불필요한 implement loop 진입 감소
- 리스크:
  - 허용 명령 설계가 느슨하면 안전 경계가 흐려질 수 있다.
- 선행 조건:
  - 명령 allowlist 설계
- 적용 순서:
  1. read-only 허용 명령 집합 정의
  2. 사전 조사 전용 실행 헬퍼 추가
  3. capability report에 verified/unverified 구분 추가
- 비고:
  - Rust native helper까지는 필요 없다. v1은 Node 레벨 제한 실행만으로도 충분하다.

### 4.4 추천안 D: append-only 이벤트 로그로 상태 저장 보강

- 항목명: JSON state 위에 event ledger 추가
- 출처 저장소 / 버전 또는 커밋:
  - `Ouroboros` EventStore/SQLite 방향
  - `oh-my-codex` team event API 및 runtime signal 축
- OMT 현재 상태:
  - `run.json`, `tasks/*.json`, `sessions/snapshot-*.json`을 덮어쓰거나 개별 파일로 기록한다.
  - 이력 조회와 causal reconstruction이 약하다.
  - 출처: [state-store](../src/state/state-store.ts), [snapshot-store](../src/state/snapshot-store.ts), [run-engine](../src/orchestrator/run-engine.ts)
- 적용 가치:
  - 중간 이상
  - 장시간 실행/장애 분석에는 매우 유효하다.
- 영향 범위:
  - `src/state/event-store.ts` 신규
  - `src/orchestrator/run-engine.ts`
  - `src/orchestrator/loop-controller.ts`
  - `src/cli/commands/report.ts`
  - `.omt/events/*.jsonl` 또는 `.omt/events/<run-id>.jsonl`
- 난이도: 중간
- 우선순위: P2
- 권장 여부: 구조 선행 후 적용
- 왜 필요한지:
  - 현재 `resume`과 `report`는 최신 상태 스냅샷을 보여줄 뿐, 왜 그 상태가 되었는지 복원하기 어렵다.
- 기대 효과:
  - 장애 원인 추적 개선
  - richer report 기반 확보
  - 향후 multi-run analytics 확장 가능
- 리스크:
  - 이벤트 스키마를 성급히 고정하면 나중에 부담이 된다.
- 선행 조건:
  - 최소 이벤트 타입 정의
  - snapshot과 event의 역할 분리
- 적용 순서:
  1. append-only event file 추가
  2. task 시작/종료/blocked/validation/delivery 이벤트 기록
  3. `report`가 snapshot + event summary를 함께 출력하도록 확장
- 비고:
  - SQLite 전환은 보류해도 된다. 먼저 JSONL ledger로 충분하다.

### 4.5 추천안 E: resume/report를 실제 운영 제어면으로 확장

- 항목명: richer status, resume semantics, morning report 강화
- 출처 저장소 / 버전 또는 커밋:
  - `oh-my-codex` README의 `status`, `resume`, `shutdown`, `hud`
  - 여러 changelog 항목의 lifecycle hardening
- OMT 현재 상태:
  - `resume`은 snapshot/handoff를 출력만 한다.
  - `report`는 runState와 evidence count만 보여준다.
  - 출처: [resume command](../src/cli/commands/resume.ts), [report command](../src/cli/commands/report.ts)
- 적용 가치:
  - 중간 이상
  - 사용성보다 운영 안정성 개선 효과가 크다.
- 영향 범위:
  - `src/cli/commands/resume.ts`
  - `src/cli/commands/report.ts`
  - `src/orchestrator/run-engine.ts`
  - `src/tasks/summarize-outcome.ts`
- 난이도: 중간
- 우선순위: P2
- 권장 여부: 즉시 적용 권장
- 왜 필요한지:
  - 현재 OMT는 "재개 가능한 상태를 남긴다"는 목표에 비해 재개 인터페이스가 빈약하다.
- 기대 효과:
  - 아침 검토 효율 상승
  - 중단 후 재진입 시 판단 비용 감소
- 리스크:
  - 실제 재개 실행 semantics까지 한 번에 넓히면 범위가 커질 수 있다.
- 선행 조건:
  - 최소한의 event ledger 또는 richer snapshot metadata
- 적용 순서:
  1. `report`에 task timeline, last attempt, validation summary 추가
  2. `resume`에 next step recommendation과 blocked gap 요약 추가
  3. 필요시 `resume --execute`를 후속 과제로 분리
- 비고:
  - UI/HUD는 나중 문제다. 먼저 CLI JSON/report 품질을 올리는 편이 맞다.

### 4.6 추천안 F: 수렴/정체/진동 판정 계측 추가

- 항목명: loop pathology telemetry
- 출처 저장소 / 버전 또는 커밋:
  - `Ouroboros` README의 convergence/stagnation/oscillation/repetitive feedback
- OMT 현재 상태:
  - 재시도는 work unit 단위로 존재하지만 정체/진동의 명시적 모델은 약하다.
  - `per_unit_max_attempts`와 변경 파일 수 제한 정도가 주요 제어다.
  - 출처: [loop-controller](../src/orchestrator/loop-controller.ts), [llm types](../src/llm/types.ts)
- 적용 가치:
  - 중간
  - semantic evaluator보다 먼저 들어가야 할 안전 장치다.
- 영향 범위:
  - `src/orchestrator/loop-controller.ts`
  - `src/state/snapshot-store.ts`
  - `src/shared/types.ts`
  - `docs/spec.yaml`
- 난이도: 중간
- 우선순위: P2
- 권장 여부: 구조 선행 후 적용
- 왜 필요한지:
  - 현재는 같은 실패를 다른 요약으로 반복해도 정량적으로 "진동"이라고 부르기 어렵다.
- 기대 효과:
  - 토큰 낭비 감소
  - blocked reason 품질 향상
  - resume 시 재시도 정책 개선
- 리스크:
  - heuristic이 성급하면 정상 진전을 오판할 수 있다.
- 선행 조건:
  - attempt metadata와 validation diff 보강
- 적용 순서:
  1. 각 시도의 changed files, failing tests, unresolved items를 구조적으로 저장
  2. 반복 패턴 탐지 규칙 추가
  3. blocked reason에 pathology code 반영
- 비고:
  - OMT v1에 필요한 것은 ontology similarity 전체가 아니라 "실용적 정체 탐지"다.

## 5. 단기 로드맵

### 1단계: 즉시 흡수 가능한 변화

- `omt doctor` 추가
- capability detection을 verified/unverified 체계로 확장
- 모델 기본값과 실행 계약의 중앙화
- `report` 출력에 validation summary, blocked gaps, last attempt 추가

### 2단계: 구조 보강

- read-only 탐색 경로 추가
- append-only event ledger 도입
- resume metadata 보강
- 정체/진동 판정 규칙 추가

### 3단계: v2 검토 항목

- 팀/병렬 오케스트레이션
- role-based agent decomposition
- HUD/tmux 기반 운영면
- native helper 또는 MCP 확장

## 6. 보류 항목과 그 이유

### 6.1 Team Mode와 다중 워커 오케스트레이션

- 출처: `oh-my-codex` README, `0.8.x` changelog
- 보류 이유:
  - OMT `docs/spec.yaml`은 `execution.mode: sequential`을 기본 원칙으로 둔다.
  - 현재 상태 저장 구조도 단일 작성자 모델에 맞춰져 있다.
- 판단:
  - v1 철학과 충돌함
  - v2 후보

### 6.2 tmux/HUD 중심 운영면

- 출처: `Ouroboros` HUD/TUI, `oh-my-codex` HUD
- 보류 이유:
  - OMT의 현재 운영 표면은 CLI JSON 중심이다.
  - 가시성 향상은 필요하지만, 이벤트 로그와 report가 먼저다.
- 판단:
  - 비용 대비 시점상 우선순위가 낮다

### 6.3 Plugin/Skill marketplace형 확장

- 출처: `Ouroboros` plugin system, `oh-my-codex` skill/prompts catalog
- 보류 이유:
  - OMT는 현재 제품 내재 기능도 아직 얕은 단계다.
  - 외부 확장 구조를 고정하기 전에 내부 계약을 먼저 단단히 해야 한다.
- 판단:
  - 구조 선행이 너무 많이 필요하다

### 6.4 SQLite 또는 MCP 중심 상태 저장 전면 전환

- 출처: `Ouroboros` EventStore/SQLite, `oh-my-codex` MCP-backed runtime state
- 보류 이유:
  - OMT 현재 요구에서는 `.omt/*.json` 파일 기반 구조가 단순성과 이식성 측면에서 아직 유리하다.
  - 바로 전면 교체하면 분석/도입 비용이 크다.
- 판단:
  - append-only event ledger로 먼저 보강하고 재평가하는 편이 낫다

### 6.5 Native Rust helper와 release hydration 체계

- 출처: `oh-my-codex` `0.9.0`, `0.9.1`
- 보류 이유:
  - OMT의 현재 핵심 문제는 cross-platform binary distribution보다 실행 전 진단과 상태 복원성이다.
- 판단:
  - 과투자 구간

## 7. 핵심 결론

- 현재 OMT에 가장 가치 있는 최신화 포인트는 `Ouroboros`의 플러그인/에이전트 확장이 아니라 "정량적 수렴/정체 관찰"이다.
- `oh-my-codex`에서 바로 가져와야 할 것은 Team Mode가 아니라 `doctor`, richer runtime controls, model/runtime contract, read-only exploration 같은 운영 안정화 층이다.
- OMT v1은 여전히 단일 운영자 순차 실행이 맞다. 따라서 최신 레퍼런스의 다중 에이전트, tmux HUD, native helper를 성급히 들여오기보다 아래 순서가 가장 합리적이다.

1. `doctor`와 preflight
2. 모델/실행 계약 중앙화
3. read-only 탐색 경로
4. append-only event ledger
5. richer report/resume
6. 정체/진동 판정

- 이 순서는 OMT의 현재 구조를 유지하면서도 야간 실행 성공률, blocked reason 품질, 아침 검토 효율을 동시에 올릴 수 있다.
