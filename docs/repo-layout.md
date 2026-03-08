# Repository Layout

## 목적

- 이 문서는 oh-my-taegun 저장소에서 어떤 디렉토리를 공개 대상으로 두고, 어떤 디렉토리를 로컬 전용으로 둘지 정하는 구조 문서다.
- 구현 시작 전 디렉토리 기준을 고정해서 공개 가능한 코드와 런타임 산출물이 섞이지 않도록 한다.

## 상위 원칙

- `src/`, `tests/`, `docs/`는 기본 공개 대상이다.
- `.omt/`, 로그, 임시 파일, 로컬 실험 디렉토리는 기본 비공개다.
- 공개 가능한 예제 설정은 `examples/` 또는 `.env.example` 형태로만 둔다.
- 회사 환경 의존 파일은 공개 루트에 두지 않는다.

## 권장 루트 구조

```text
.
├── README.md
├── .gitignore
├── docs/
├── src/
├── tests/
├── scripts/
├── examples/
├── .env.example
└── .omt/              # local-only runtime state
```

## 디렉토리별 정책

### `docs/`

- 공개 가능한 설계 문서와 운영 문서를 둔다.
- 민감 정보가 없는 문서만 유지한다.
- 로컬 실사용 로그나 실제 secret 값은 기록하지 않는다.

### `src/`

- oh-my-taegun 핵심 구현을 둔다.
- CLI, orchestrator, state, validation, delivery, shared 모듈을 포함한다.
- 공개 가능한 범용 코드만 둔다.

### `tests/`

- unit, integration, recovery, policy, e2e 테스트를 둔다.
- 실제 운영 계정 의존 테스트는 fixture 또는 mock로 대체한다.

### `scripts/`

- 개발 보조 스크립트와 문서 검증 스크립트를 둔다.
- 회사 내부 전용 자동화 스크립트는 두지 않는다.

### `examples/`

- 안전한 샘플 설정, 예제 입력, mock fixture를 둔다.
- 실서비스 endpoint나 운영 계정 정보는 두지 않는다.

### `.omt/`

- 런타임 상태 저장소다.
- snapshot, handoff, evidence, blocked report, local run state를 포함한다.
- 공개 대상이 아니며 항상 ignore 한다.

## 공개 가능한 파일 예시

- `README.md`
- `docs/*.md`
- `docs/*.yaml`
- `src/**/*.ts`
- `tests/**/*.ts`
- `examples/**`
- `.env.example`

## 공개 제외 파일 예시

- `.omt/**`
- `.env`
- `.env.*`
- `*.log`
- `secrets/**`
- `private/**`
- `local/**`
- 회사 전용 설정 파일

## 공개 준비 브랜치 기준

- `publish/*` 브랜치에서는 다음만 허용한다.
  - 공개 가능한 코드
  - 공개 가능한 문서
  - 예제 설정
  - 재현 가능한 테스트 설정
- 다음은 포함하지 않는다.
  - 로컬 상태 파일
  - 실사용 로그
  - 운영 비밀값
  - 사내 경로 또는 사내용 도구 설정

## 구현 시작 체크리스트

- `src/` 생성
- `tests/` 생성
- `scripts/` 생성
- `.env.example` 추가
- README에 설치/실행 방법 보강
- 문서 기반 traceability 검증 스크립트 추가
