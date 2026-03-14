---
name: omt
description: Operate OMT V2 on a target repository by resolving the engine repo, collecting design answers in chat, validating them, and then running design, run, report, and resume through the CLI. Use only when the user explicitly invokes $omt or is clearly asking to operate an OMT V2 run.
---

# OMT

## When to use

Use this skill only when the user explicitly invokes `$omt` or clearly asks to operate an OMT V2 run on a repository.

Typical cases:

- run `design:v2 -> run:v2 -> report:v2` on a target repository
- continue or inspect a blocked V2 run with `report:v2` or `resume:v2`
- collect model policy and delivery policy in chat, then hand them to OMT through `--answers-file`

## Do not use

- generic coding tasks unrelated to OMT operation
- V1 operation
- reimplementing OMT runtime behavior inside the skill
- silently invoking OMT because the user mentioned PRs, deploys, or automation in general

## Engine Repo vs Target Repo

Resolve `OMT_HOME` first.

1. If the user explicitly gives the engine repo path, use it.
2. Otherwise, if the current working directory looks like the `oh-my-taegun` engine repo, use the current working directory.
3. Otherwise, ask for the engine repo path before doing anything else.

Resolve the target repo second.

1. If the user explicitly gives the target repo path, use it.
2. Otherwise, if the current working directory is not `OMT_HOME`, propose the current working directory as the target repo and confirm.
3. Otherwise, ask for the target repo path.

If `OMT_HOME` and target repo are the same path, explicitly confirm whether the user wants to operate on the OMT engine repo itself.

## Required Reads

Before operating OMT V2, read these files from `OMT_HOME` in order:

1. `AGENTS.md`
2. `docs/v2/operator-guide.md`
3. `docs/v2/spec.md`
4. `docs/v2/state-schema.yaml`

Use this precedence when they disagree:

- procedure: `docs/v2/operator-guide.md`
- contracts: `docs/v2/spec.md`, `docs/v2/state-schema.yaml`
- repo-specific guardrails: `AGENTS.md`

If there is a material conflict, tell the user briefly and proceed using that precedence.

## Discovery Rules

Before asking the user for design inputs, confirm:

- `node -v` is at least `22`
- `OMT_HOME/package.json` contains `design:v2`, `run:v2`, `report:v2`, and `resume:v2`
- the engine repo and target repo paths exist

If one of these fails, stop and report the missing prerequisite instead of trying to improvise.

## Chat Interview

Do not open the raw TTY interview by default. Collect the design input in chat, validate it, and then write an answers file for `design:v2 --non-interactive`.

Always collect or confirm:

- engine repo path
- target repo path
- surveyed models
- approved models
- design model
- execution model
- verifier model
- work-unit budget profile
- reasoning efforts
- fallback chain
- target delivery stage

Collect these when `targetStage >= real-pr`:

- target branch
- feature branch template
- PR title template

Collect these when `targetStage >= dev`:

- dev deploy command
- dev validation command
- dev runner kind
- dev env refs

Collect these when `targetStage = prod`:

- prod deploy command
- prod validation command
- prod runner kind
- prod env refs
- production approval for this run

## Answer Quality Gate

Track each collected field with exactly one of these states:

- `verified`
- `answered`
- `assumed`
- `unanswered`

Use them this way:

- `verified`: confirmed from repo structure, docs, or runtime inspection
- `answered`: explicitly provided by the user and semantically valid
- `assumed`: low-risk recommendation that the user explicitly confirmed
- `unanswered`: missing, vague, conflicting, or unusable

Treat these as unusable and re-ask:

- blank values
- vague placeholders such as `모르겠어요`, `적당히`, `아무거나`, `TBD`, `나중에`
- invalid stage values
- approved models that are not in surveyed models
- design, execution, or verifier models that are not in approved models
- missing branch or template fields for `real-pr` and above
- missing deploy or validation commands for `dev` or `prod`
- any `prod` approval answer that is not an explicit yes

Do not write an answers file or invoke OMT while any required field remains `unanswered`.

## Clarification Loop

Close each field with this loop:

1. Ask once.
2. Validate immediately.
3. If invalid or vague, explain the gap in one line and ask again for the same field.
4. If still invalid, ask one more time.
5. If the field is still unresolved after two clarification attempts, stop the whole flow.

When stopping:

- do not create the answers file
- do not call `design:v2`
- show a short unresolved checklist
- if helpful, suggest the raw fallback command without pretending the run is ready

Do not loop forever.

## Defaults

Only these silent defaults are allowed:

- `deliveryPolicy.reviewRequired`
  - `true` for `real-pr` and above
  - `false` otherwise
- `deliveryPolicy.fallbackMode`
  - always `blocked-handoff`

Everything else must be either user-provided or proposed and explicitly confirmed.

Recommendation rules:

- if target stage is missing, recommend `dry-run` and confirm
- if there is exactly one approved model, recommend it for design, execution, and verifier, then confirm
- if there is one approved model, recommend `low_capability`; if there are two or more, recommend `high_capability`; then confirm
- for `real-pr` and above, read profile or repo defaults when available, propose branch and template values, then confirm

## Answers File

Write the chat-collected input to:

- `$TMPDIR/omt/<timestamp>-answers.json`

Use this structure:

```json
{
  "modelPolicy": {},
  "deliveryPolicy": {}
}
```

Rules:

- include only fields required for the selected target stage
- omit stage-specific fields that are out of scope for the current target stage
- omit `prod.approvedForThisRun` unless the target stage is `prod`
- keep `deliveryPolicy.fallbackMode` fixed to `blocked-handoff`

After `design:v2`:

- delete the answers file on success
- keep it on failure and tell the user where it is

## Command Order

Run from `OMT_HOME`.

Design:

```bash
npm run design:v2 -- --repo-path <target-repo> --non-interactive --answers-file <answers-file>
```

Run:

```bash
npm run run:v2 -- --repo-path <target-repo>
```

Report:

```bash
npm run report:v2 -- --repo-path <target-repo> --run-id <runId>
```

Resume:

```bash
npm run resume:v2 -- --repo-path <target-repo> --run-id <runId>
```

Read `runId` from the JSON stdout of `run:v2`. Use `.omt/v2/state/run.json` only as a fallback if stdout is unavailable.

## Auto-Progress Policy

If the selected target stage is:

- `dry-run`
- `commit`
- `real-pr`

then run `design:v2`, `run:v2`, and `report:v2` in one flow after the answers pass validation.

If the selected target stage is `dev`:

- show the design summary
- get one more explicit confirmation
- then run `run:v2` and `report:v2`

If the selected target stage is `prod`:

- show the design summary
- require an explicit confirmation
- require `approvedForThisRun=true`
- only then run `run:v2` and `report:v2`

Never silently promote a run to a higher stage than the user requested.

## Doctor Policy

Do not call `doctor` on the happy path. Use it only when:

- the user explicitly asks for diagnosis first
- `design:v2` blocks for preflight or capability reasons
- repo, test, token, or env readiness is unclear

Otherwise rely on the preflight behavior inside `design:v2`.

## Reporting

After every operated run, summarize:

- `OMT_HOME`
- target repo
- selected target stage
- `runId`
- overall status
- current phase
- current stage
- completed stages
- blocked reasons
- reviewer decision
- PR URL
- report path
- handoff path if present
- next recommended action

Also reference the key artifacts:

- `.omt/v2/design/seed.json`
- `.omt/v2/events/<run-id>.jsonl`
- `.omt/v2/reports/<run-id>.json`
- `.omt/v2/handoffs/<run-id>/handoff.md`

Do not declare the run successful from `run:v2` status alone. Read `report:v2` before claiming completion.

## Safety Rules

- Do not hardcode baseline model names.
- Do not hardcode deploy commands or approval policies.
- Do not create a second state system outside `.omt/v2/`.
- Do not assume `unverified` capabilities are executable.
- Do not assume design freeze happened before `.omt/v2/design/seed.json` exists.
- Do not silently proceed when required inputs remain unresolved.
