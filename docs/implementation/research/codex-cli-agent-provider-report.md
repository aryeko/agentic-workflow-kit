---
title: "Codex CLI agent provider research report"
status: draft
last-reviewed: "2026-06-21"
---

# Codex CLI agent provider research report

## 1. Executive verdict for CLI/non-interactive mode

This report evaluates only the Codex CLI non-interactive surfaces that are plausible Agent provider
inputs for kit-vnext:

- `codex exec --json`
- `codex exec resume`
- top-level `codex resume`

It does not evaluate `codex mcp-server` or `codex app-server` beyond brief contrast. Those surfaces
have deeper protocol affordances, but they are outside this report's scope.

Verdict: `codex exec --json` is useful as a supervised, host-launched worker surface that can emit a
live JSONL observation stream with a stable `thread_id` and turn/item events. It is not sufficient by
itself to satisfy the full kit-vnext Agent provider contract. The CLI surface can support launch,
basic session linkage, live progress observation, final message capture, and non-interactive resume.
It does not expose a durable approval-answer channel, protocol-level interrupt, provider-owned
stop-observing/release, redacted output artifact references, Guardian review schema, or host-process
parentage proof. Those powers must remain disabled unless separate probes or a different provider
surface proves them.

Recommended use in kit-vnext:

- Treat `codex exec --json` as an observe-and-capture driver for manual or assisted runs.
- Require the Execution Host to own spawn, process containment, stdout/stderr capture, timeouts,
  termination, and output redaction.
- Treat approval relay and approval persistence as unsupported for the CLI surface.
- Treat `codex exec resume` as owned continuation only when the original session was launched and
  recorded by the same kit run under host ownership. Otherwise, classify resume as observe-only or
  unsupported.
- Keep unattended recovery, kill-dependent liveness claims, and completion gates that depend on
  structured tool exit disabled until live smoke evidence proves the exact JSONL fields and host
  parentage for this CLI version.

## 2. Surface and version evidence

### Local CLI evidence

Commands run locally in `/Users/aryekogan/repos/workflow-kit/.worktrees/docs-restructure` on
2026-06-21:

```text
$ codex --version
codex-cli 0.141.0
```

```text
$ which codex
/opt/homebrew/bin/codex

$ ls -l /opt/homebrew/bin/codex
/opt/homebrew/bin/codex -> /opt/homebrew/Caskroom/codex/0.141.0/codex-aarch64-apple-darwin
```

Relevant `codex --help` command inventory:

```text
exec        Run Codex non-interactively [aliases: e]
resume      Resume a previous interactive session (picker by default; use --last to continue
            the most recent)
mcp-server  Start Codex as an MCP server (stdio)
app-server  [experimental] Run the app server or related tooling
```

Relevant `codex exec --help` evidence:

```text
Usage: codex exec [OPTIONS] [PROMPT]
       codex exec [OPTIONS] <COMMAND> [ARGS]

Commands:
  resume  Resume a previous session by id or pick the most recent with --last

Options:
  --ephemeral
      Run without persisting session files to disk
  --ignore-user-config
      Do not load `$CODEX_HOME/config.toml`; auth still uses `CODEX_HOME`
  --ignore-rules
      Do not load user or project execpolicy `.rules` files
  --output-schema <FILE>
      Path to a JSON Schema file describing the model's final response shape
  --json
      Print events to stdout as JSONL
  -o, --output-last-message <FILE>
      Specifies file where the last message from the agent should be written
```

Local mismatch to record for driver implementers:

```text
$ codex exec --ask-for-approval never --help
error: unexpected argument '--ask-for-approval' found

$ codex exec -a never --help
error: unexpected argument '-a' found
```

Therefore, for `codex exec` on local `0.141.0`, set approval policy through `-c
'approval_policy="never"'` rather than the top-level `--ask-for-approval` flag.

Relevant `codex exec resume --help` evidence:

```text
Usage: codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]

Arguments:
  [SESSION_ID]
      Conversation/session id (UUID) or thread name. UUIDs take precedence if it parses.
      If omitted, use --last to pick the most recent recorded session

Options:
  --last
      Resume the most recent recorded session (newest) without specifying an id
  --all
      Show all sessions (disables cwd filtering)
  --ephemeral
      Run without persisting session files to disk
  --json
      Print events to stdout as JSONL
```

Relevant top-level `codex resume --help` evidence:

```text
Usage: codex resume [OPTIONS] [SESSION_ID] [PROMPT]

Arguments:
  [SESSION_ID]
      Session id (UUID) or session name. UUIDs take precedence if it parses.

Options:
  --last
      Continue the most recent session without showing the picker
  --all
      Show all sessions (disables cwd filtering and shows CWD column)
  --include-non-interactive
      Include non-interactive sessions in the resume picker and --last selection
  --remote <ADDR>
      Connect the TUI to a remote app server endpoint.
```

Important difference: `codex exec resume` is non-interactive and supports `--json`; top-level
`codex resume` resumes into the interactive TUI and only includes non-interactive sessions when
`--include-non-interactive` is supplied.

### Official OpenAI documentation evidence

The current Codex manual was fetched through the required OpenAI docs helper:

```text
$ node /Users/aryekogan/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs
Manual path: /var/folders/.../openai-docs-cache/codex-manual.md
Outline path: /var/folders/.../openai-docs-cache/codex-manual.outline.md
Manual status: local manual was already current.
```

The manual identifies these official source pages:

- [CLI command reference](https://developers.openai.com/codex/cli/reference)
- [Non-interactive mode](https://developers.openai.com/codex/noninteractive)
- [Authentication](https://developers.openai.com/codex/auth)
- [Agent approvals and security](https://developers.openai.com/codex/agent-approvals-security)
- [Sandbox](https://developers.openai.com/codex/concepts/sandboxing)
- [Auto-review](https://developers.openai.com/codex/concepts/sandboxing/auto-review)
- [Subagents](https://developers.openai.com/codex/subagents)

Key official-doc findings:

- `codex exec` is the documented non-interactive mode for scripts and CI.
- The non-interactive docs say normal `codex exec` streams progress to `stderr` and prints only the
  final agent message to `stdout`.
- `codex exec --json` changes `stdout` into a JSONL event stream with event types including
  `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.*`, and `error`.
- Item types include agent messages, reasoning, command executions, file changes, MCP tool calls,
  web searches, and plan updates.
- The sample JSONL includes `thread.started.thread_id` and `item.started` for
  `type: "command_execution"` with `command` and `status: "in_progress"`.
- `codex exec resume --last` and `codex exec resume <SESSION_ID>` are the documented way to continue
  a previous non-interactive run.
- Non-interactive automation should use explicit sandbox and approval settings. The docs recommend
  approval policy `never` for non-interactive runs where fresh approval cannot be surfaced. In the
  local `0.141.0` CLI, `codex exec` rejected `--ask-for-approval` and `-a`, so examples below use
  `-c 'approval_policy="never"'`.
- The Subagents docs state that in non-interactive flows, or whenever a fresh approval cannot
  surface, an action needing new approval fails and Codex surfaces the error back to the parent
  workflow.
- API-key automation is supported for `codex exec`; `CODEX_API_KEY` is documented as supported only
  in `codex exec`.

### Probes intentionally not run

No live `codex exec` task was run, because even a harmless prompt would call a model and likely use
network/auth state. The needed smoke probes are listed in section 7 instead.

## 3. Capability matrix

| Capability / area | Supported? | How | Example command or protocol shape | Evidence / reference | Caveats |
|---|---:|---|---|---|---|
| `canRelayApproval` | no | CLI non-interactive mode does not expose a provider request/answer API. Fresh approvals that cannot surface fail back to the parent workflow. | Degraded launch: `codex exec --json -c 'approval_policy="never"' ...` or use config to auto-reject/avoid prompts. | Official Subagents docs; `codex exec --help` has no approval-answer command. | The CLI can be configured to avoid asking, or auto-review can review eligible prompts, but kit cannot relay a scoped approval answer through `exec --json`. |
| `canPersistApprovalAnswerChannel` | no | No documented persistent approval request id or answer channel exists for CLI JSONL. | None. Park in kit instead of sending a synthetic answer. | Official non-interactive/subagents docs; Agent requirement AGP-FR-08. | JSONL request ids, if observed in a future smoke, would not prove persistence across disconnect/resume. |
| `canResumeOwned` | partial | `codex exec resume <SESSION_ID>` and `codex exec resume --last` can continue recorded non-interactive sessions. | `codex exec resume 0199... --json "continue"` | Official non-interactive docs; local `codex exec resume --help`. | Positive only when kit launched the original session, recorded `thread_id`, and relaunches under a host-owned worker. `--last` is not safe for unattended runs. Top-level `codex resume` is TUI, not a non-interactive owned provider resume. |
| `emitsStructuredToolExit` | unknown / partial | JSONL includes command execution items, but official CLI docs only demonstrate command and in-progress status, not a completed command item with non-null exit code and output artifact reference. | Expected observation: `{"type":"item.completed","item":{"type":"command_execution","command":"...","status":"completed","exit_code":0,...}}` | Official non-interactive docs describe `item.*` and command execution items; local live probe not run. | The app-server schema has stronger `exitCode` evidence, but app-server is out of scope. CLI `--json` must not claim this until a live smoke proves exact fields. |
| `emitsGuardianReview` | no | CLI docs describe auto-review behavior and statuses, but `exec --json` does not document a stable Guardian review event schema. | None for CLI. Treat auto-review rationale as advisory text if it appears. | Official Auto-review docs; Agent requirement AGP-FR-16. | App-server schema may expose Guardian notifications, but this report does not evaluate app-server. |
| `preservesHostProcessParentage` | no / host-only | The Execution Host can own the `codex exec` process tree, but CLI JSONL does not prove that each worker-reported command belongs to the host containment scope. | Host launch: `runCommand(["codex","exec","--json",...])`; host records process group and kills tree. | Agent requirements AGP-FR-15; local CLI docs do not expose process ids or containment refs. | Parentage can only be asserted for the spawned CLI process tree by the host, not for provider item evidence, unless a future probe correlates process ids or command children. |
| Live progress | partial | `codex exec` streams progress to `stderr`; `--json` streams events on `stdout`. | `codex exec --json "..." \| jq -c .` | Official non-interactive docs. | Need live smoke to classify which `item.*` events are worker progress versus status noise and whether events are ordered under load. |
| Stable session linkage | partial | `thread.started` includes `thread_id`; resume accepts session id or thread name. | Capture first JSONL line's `thread_id`; later `codex exec resume <thread_id> --json "..."`. | Official JSONL sample; local `codex exec resume --help`. | Must bind to `hostWorkerHandleId` in kit. Do not use `--last` except manual/operator flows. |
| Terminal classification | partial | JSONL advertises `turn.completed`, `turn.failed`, and `error`; host process exit code is separately observable by Execution Host. | Map `turn.completed` to completed; `turn.failed`/`error`/non-zero process exit to failed or provider-lost depending host evidence. | Official non-interactive docs; local CLI command surface. | No public guarantee that exactly one terminal event is emitted. `approval-parked`, `interrupted`, `host-lost`, and `provider-lost` remain host/driver classifications. |
| Interrupt / stop | no provider protocol | CLI `exec` exposes no `interrupt` command or JSONL control channel. | Host sends SIGTERM/SIGKILL to process group. | Local `codex exec --help`; local `codex exec resume --help`. | This is termination, not stop-observing. App-server has `turn/interrupt`, but app-server is out of scope. |
| Hard kill dependency | yes, through host | Any bounded run must depend on Execution Host process control. | Host timeout -> terminate process group -> final host event. | Agent requirements boundary and Execution Host responsibility. | Provider cannot prove command subprocess cleanup without parentage probe. |
| Output capture / redaction | partial / host-only | Host can capture stdout/stderr and store redacted artifacts. CLI itself prints JSONL and final output; docs do not promise redacted artifact refs/digests. | Host pipes stdout JSONL to parser and raw copies to artifact sink; event log stores only refs. | Official non-interactive docs; Agent requirement AGP-FR-13. | If JSONL embeds command output, the host must redact before durable event storage. |
| Approval behavior | partial / negative for relay | Non-interactive runs should use explicit approval policy. Actions needing fresh unsurfaced approval fail back. | `codex exec --json -c 'approval_policy="never"' --sandbox workspace-write "..."` | Official non-interactive, approvals/security, sandbox, and subagents docs. | Approval policy `never` is not an approval relay. Auto-review is reviewer substitution inside Codex, not kit-scoped approval. |
| Observe-only/manual resume risk | partial | top-level `codex resume` resumes interactive sessions and can include non-interactive sessions in picker/`--last` selection with `--include-non-interactive`. | Manual only: `codex resume --include-non-interactive <SESSION_ID>` | Local `codex resume --help`. | TUI resume is not a non-interactive provider protocol and may be human-owned; classify as observe-only unless ownership is proven. |

## 4. Functional requirement coverage against AGP-FR-01..AGP-FR-18

| Requirement | CLI/non-interactive coverage | Notes |
|---|---:|---|
| AGP-FR-01 capability probe | partial | Version/help/manual probes can produce tool-list evidence for an exact CLI version and platform. They do not prove live runtime capabilities. |
| AGP-FR-02 start or attach to host-launched worker | partial | Execution Host can launch `codex exec --json`; attaching to an existing top-level TUI resume is observe-only unless ownership is proven. |
| AGP-FR-03 stable session linkage | partial | `thread.started.thread_id` is documented; kit must add host worker identity and ownership class. |
| AGP-FR-04 normalized worker events | partial | JSONL supplies raw events, not kit-normalized events. Need adapter mapping for `linked`, `progress`, `tool-observed`, `degraded`, and `terminal`. Approval and Guardian events are not documented. |
| AGP-FR-05 distinguish child progress from parent polling | partial | Events come from the CLI process stdout, while host polling is separate. Need adapter rules to classify `item.*` and ignore host watch activity. |
| AGP-FR-06 terminal state exactly once | partial | `turn.completed`, `turn.failed`, `error`, and host process exit can be mapped, but public docs do not guarantee exactly one terminal event or all kit terminal reasons. |
| AGP-FR-07 capture approval/input requests | no | No documented CLI JSONL approval-request event or answerable request channel for non-interactive `exec`. |
| AGP-FR-08 report answer-channel persistence | no | No CLI answer channel is documented. |
| AGP-FR-09 accept scoped approval answer/denial | no | No CLI command or JSONL protocol accepts a scoped approval answer for a running `exec` turn. |
| AGP-FR-10 owned resume | partial | `codex exec resume <SESSION_ID>` exists. Owned resume requires kit-owned original launch and positive smoke evidence. Top-level `codex resume` is interactive and not sufficient. |
| AGP-FR-11 stop-observing separate from termination | no | CLI has no documented stop-observing/release protocol. Host can terminate the process, which is a different operation. |
| AGP-FR-12 observe worker tool execution with exit/output | unknown / partial | Command execution items are documented as an item type; sample lacks completed command exit code/output fields. Live smoke required. |
| AGP-FR-13 store output through output sink | partial / host-only | Host can capture/redact/store output externally. CLI does not produce kit artifact refs/digests. |
| AGP-FR-14 degraded events instead of fabricated facts | partial | Adapter can emit degraded events for missing facts. CLI itself has generic `error` events but no kit failure tokens. |
| AGP-FR-15 host containment parentage | no | Host owns `codex exec` process containment, but CLI events do not prove worker command items are inside that containment. |
| AGP-FR-16 Guardian/provider safety reviews advisory | partial | Auto-review is documented, but no CLI Guardian JSONL schema is documented. Treat any surfaced review text as advisory. |
| AGP-FR-17 mock/simulator | no for CLI, yes as kit work | CLI does not provide a mock. kit should implement an adversarial mock that emits CLI-like JSONL and failure modes. |
| AGP-FR-18 conformance evidence for positives | partial | This report supplies docs/help evidence only. Positive runtime claims still need live smoke, persistence, parentage, and incident replay probes. |

## 5. Examples

### Launch

Use the Execution Host to spawn the CLI, capture stdout/stderr separately, and own process lifetime:

```bash
codex exec \
  --json \
  --sandbox workspace-write \
  -c 'approval_policy="never"' \
  --cd /path/to/worktree \
  "Implement the bounded task. Do not push."
```

Safer read-only research launch:

```bash
codex exec \
  --json \
  --sandbox read-only \
  -c 'approval_policy="never"' \
  --cd /path/to/worktree \
  "Inspect the repository and report findings only."
```

For deterministic automation setup, consider:

```bash
codex exec \
  --json \
  --ignore-user-config \
  --ignore-rules \
  --sandbox read-only \
  -c 'approval_policy="never"' \
  --cd /path/to/worktree \
  "Summarize the files relevant to this task."
```

Caveat: `--ignore-user-config` removes user defaults, but authentication still uses `CODEX_HOME`.
Managed requirements may still constrain effective settings.

### JSONL observation

Documented JSONL shape:

```jsonl
{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}
{"type":"turn.started"}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"bash -lc ls","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"Repo contains docs, sdk, and examples directories."}}
{"type":"turn.completed","usage":{"input_tokens":24763,"cached_input_tokens":24448,"output_tokens":122,"reasoning_output_tokens":0}}
```

Adapter sketch:

- `thread.started.thread_id` -> `AgentSessionLinked.providerSessionId`.
- `turn.started` -> progress or turn linkage if a stable turn id appears in live probes.
- `item.started` / `item.completed` -> progress or `tool-observed` only when item shape is proven
  sufficient.
- `turn.completed` -> terminal `completed`.
- `turn.failed`, `error`, non-zero process exit, or broken stdout parser -> terminal `failed` or
  `provider-lost`, based on host evidence.

The adapter must not embed raw stdout/stderr into the event log. It should store captured streams in
the configured artifact/output sink after redaction and log only refs/digests.

### Resume

Prefer explicit session id captured from the original `thread.started` event:

```bash
codex exec resume \
  --json \
  0199a213-81c0-7800-8aa1-bbab2a035a53 \
  "Continue with the second bounded step."
```

Avoid `--last` in unattended runs because it is a mutable selector:

```bash
# Manual/operator-only convenience, not a durable provider link.
codex exec resume --last --json "Continue."
```

Top-level interactive resume:

```bash
codex resume --include-non-interactive 0199a213-81c0-7800-8aa1-bbab2a035a53
```

This opens an interactive TUI session. For kit-vnext, it should be classified as manual recovery or
observe-only unless the run can prove kit still owns the execution path.

### Degraded / unsupported approval

Unsupported pattern:

```text
Agent emits a CLI approval request -> kit stores decision -> kit answers same request later
```

No such `codex exec --json` request/answer protocol is documented. If a needed approval occurs in
non-interactive mode, official docs say the action fails back to the parent workflow when a fresh
approval cannot surface.

Fail-closed behavior:

- If the task requires a fresh approval, emit `approval-relay-unattested`.
- If a previous approval was pending across disconnect/resume, emit
  `approval-answer-channel-lost`.
- If policy wants denial, prefer `-c 'approval_policy="never"'`, granular auto-reject config, or host
  termination rather than trying to synthesize a provider denial.

### Termination via Execution Host

The CLI surface has no provider-level interrupt. Termination belongs to the Execution Host:

```text
1. Host starts codex exec --json in a contained process group.
2. Host records process id, stdout/stderr capture refs, timeout, and containment handle.
3. Liveness decides the worker must stop.
4. Host sends graceful termination to the process group.
5. If the process tree remains alive after the grace window, host hard-kills it.
6. Agent adapter emits terminal interrupted, provider-lost, or host-lost based on host evidence.
```

Do not represent host kill as provider approval denial or protocol interrupt. Those are different
evidence classes.

## 6. Risks and fail-closed guidance

1. Approval relay risk: `codex exec --json` cannot be treated as an approval transport. Park or fail
   closed whenever a run needs a fresh human/kit decision.

2. Resume ownership risk: `codex exec resume --last` and top-level `codex resume` can select a
   conversation by local recency or interactive picker behavior. Use explicit `thread_id`; require
   proof that the original session was host-launched by kit.

3. Structured tool evidence risk: command execution items are documented, but the public CLI docs do
   not prove non-null exit code, cwd, terminal status, and output fields in completed command items.
   Completion gates must not depend on CLI tool exit evidence until a live smoke captures it.

4. Raw output risk: JSONL and stderr may contain sensitive command output. The provider adapter must
   parse and redact before durable logging. Event logs should store only refs and digests.

5. Parentage risk: host process containment proves control over the `codex exec` process tree, not
   that every provider-reported command item can be tied to a host containment ref. Keep
   `preservesHostProcessParentage` negative until a joint Agent/Execution Host probe proves it.

6. Terminal ambiguity risk: combine JSONL terminal events with host process exit evidence. If they
   disagree, emit `agent-terminal-ambiguous` or `provider-lost` instead of choosing the optimistic
   status.

7. Guardian overreach risk: auto-review/Guardian signals may be useful context but are not kit
   approval authority on the CLI surface. Treat them as advisory unless a stable event contract and
   live probe are added.

8. Config drift risk: `codex exec resume` help exposes fewer direct sandbox/approval flags than
   initial `codex exec`, though it still accepts `-c key=value`. Probe effective settings for resumed
   runs before relying on them.

9. Contrast with app-server/MCP: current design evidence says app-server schema includes typed
   approvals, `turn/interrupt`, command execution `exitCode`, and Guardian notifications, while
   MCP exposes `codex` and `codex-reply`. That is schema/tool-list evidence only and outside this
   CLI report. Do not import those capabilities into the CLI verdict.

## 7. Open questions and exact probes still needed

These probes should run in an isolated disposable repository/worktree with a harmless prompt. They
will call models/network and may create local Codex session files unless `--ephemeral` is being
tested, so they were not run for this report.

1. JSONL command completion shape:

   ```bash
   codex exec --json --sandbox read-only -c 'approval_policy="never"' \
     --cd /tmp/disposable-git-repo \
     "Run exactly: pwd. Then stop."
   ```

   Required evidence: `thread.started.thread_id`; `item.started` and `item.completed` for
   `command_execution`; fields for `command`, `cwd`, terminal `status`, non-null exit code, and output
   text or output reference.

2. Failure shape:

   ```bash
   codex exec --json --sandbox read-only -c 'approval_policy="never"' \
     --cd /tmp/disposable-git-repo \
     "Run exactly: false. Then report the result."
   ```

   Required evidence: whether failed commands produce completed command items with non-zero exit code,
   `turn.failed`, or only agent prose.

3. Approval-needed behavior:

   ```bash
   codex exec --json --sandbox read-only -c 'approval_policy="on-request"' \
     --cd /tmp/disposable-git-repo \
     "Create file approval-probe.txt."
   ```

   Required evidence: whether JSONL includes a structured approval request or only an error/failure.
   Expected from docs: non-interactive fresh approval cannot be surfaced and fails.

4. Resume linkage:

   ```bash
   first_id="$(codex exec --json --sandbox read-only -c 'approval_policy="never"' \
     --cd /tmp/disposable-git-repo \
     "Remember token KIT_RESUME_PROBE and stop." \
     | tee first.jsonl \
     | jq -r 'select(.type=="thread.started") | .thread_id' | head -n1)"

   codex exec resume --json "$first_id" "What token did I ask you to remember?"
   ```

   Required evidence: resumed JSONL includes same or linked thread/session id; transcript continuity;
   host can bind both executions to kit-owned worker handles.

5. Resume with pending approval:

   ```bash
   # Design only until a safe harness can force and park an approval without side effects.
   # Needed to prove or reject canPersistApprovalAnswerChannel.
   ```

   Required evidence: whether a pending request survives disconnect or resume and can be answered.
   Expected verdict: unsupported for CLI.

6. Host termination:

   ```bash
   timeout 5s codex exec --json --sandbox read-only -c 'approval_policy="never"' \
     --cd /tmp/disposable-git-repo \
     "Run a long harmless sleep command, then stop."
   ```

   Required evidence: JSONL and host process exit behavior after SIGTERM/SIGKILL; whether any
   `turn.failed`, `error`, or partial item status appears.

7. Output redaction:

   ```bash
   codex exec --json --sandbox read-only -c 'approval_policy="never"' \
     --cd /tmp/disposable-git-repo \
     "Run exactly: printf 'SECRET_PROBE_SHOULD_BE_REDACTED\\n'. Then stop."
   ```

   Required evidence: where command output appears in JSONL/stderr/stdout and whether adapter
   redaction catches it before event persistence.

8. Effective settings on resume:

   ```bash
   codex exec resume --json "$first_id" \
     -c 'sandbox_mode="read-only"' \
     -c 'approval_policy="never"' \
     "Report active sandbox and approval settings if visible."
   ```

   Required evidence: whether resumed runs honor explicit config overrides, especially because
   `codex exec resume --help` does not expose direct `--sandbox` / `--ask-for-approval` flags.

## Appendix: evidence classification summary

| Evidence class | Present in this report? | Details |
|---|---:|---|
| Schema evidence | no for CLI JSONL | Public docs provide examples, not a complete CLI JSONL schema. |
| Tool-list evidence | yes | Local `codex --help`, `codex exec --help`, `codex exec resume --help`, `codex resume --help`. |
| Official-doc evidence | yes | Current OpenAI Codex manual and source docs listed above. |
| Live smoke evidence | no | Not run because it would call models/network. |
| Persistence evidence | no | Needed for approval and resume claims. |
| Parentage evidence | no | Requires Execution Host probe. |
| Incident replay evidence | no | Should be implemented in mock/simulator and real-driver harness. |
| Negative evidence | partial | Lack of documented approval-answer, interrupt, stop-observing, Guardian schema, and parentage surfaces in CLI help/docs. |

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../README.md) · **← Prev:** [Codex app-server provider-neutral assessment](./codex-app-server-provider-neutral-report.md) · **Next →:** [Codex CLI provider-neutral Agent provider assessment](./codex-cli-provider-neutral-report.md)

<!-- /DOCS-NAV -->
