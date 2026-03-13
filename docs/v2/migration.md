# OMT V2 Migration

## Strategy

- Keep the current V1 harness as a regression floor.
- Add V2 documents and tests without removing V1 commands.
- Treat current `gpt-5.4` defaults as V1 dogfood configuration only.
- Move V2 model handling to interview-derived policy.

## Compatibility Rules

- Existing `npm run test:*` commands stay valid.
- V2 adds `npm run test:*:v2` commands.
- Existing V1 docs remain the source of truth for V1 behavior.
- V2 is additive until runtime implementation catches up.
- V2 runtime is activated with `--profile docs/v2/spec.yaml`.
- `doctor` and `inspect` are public V2 commands, while `design`, `run`, `resume`, and `report` keep V1 defaults unless a V2 profile is passed.
- V2 state lives under `.omt/v2/` and does not replace the existing `.omt/` V1 runtime artifacts.
