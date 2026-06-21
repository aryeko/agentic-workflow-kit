---
title: "Codex CLI provider-neutral Agent provider assessment"
status: draft
last-reviewed: "2026-06-21"
---

# Codex CLI provider-neutral Agent provider assessment

## Scope

This report evaluates these Codex CLI surfaces only:

- `codex exec --json`
- `codex exec resume`
- top-level `codex resume`

It intentionally does not assess `codex mcp-server` or `codex app-server`, except for brief
contrast. No existing files under `docs/implementation/research/*.md` were read or used.

## Evidence used

- Requirements: `docs/implementation/agent-provider-requirements.md`.
- Agent Execution design: `docs/design/30-domain-reference/providers/agent-execution/README.md`.
- Agent contract: `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md`.
- Capability/conformance detail: `docs/design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md`.
- Official Codex manual fetched with
  `/Users/aryekogan/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs`.
  The helper returned a current local manual at
  `/var/folders/h_/mbzpc88j3w18hmcdd0j5x53h0000gn/T/openai-docs-cache/codex-manual.md`.
- Local CLI help on this machine:
  - `codex --version`: `codex-cli 0.141.0`
  - `codex --help`
  - `codex exec --help`
  - `codex exec resume --help`
  - `codex resume --help`
  - `codex -C . exec resume --help`
- Platform:
  - macOS 26.5.1, Darwin 25.5.0, arm64.

No model-calling, repo-mutating, request-answer, approval, or persistence live probes were run.
All positive claims below are therefore documentation, local-help, or tool-list evidence unless
explicitly marked as a required probe.

## Executive verdict

`codex exec --json` is a credible weak Agent provider surface for final-result execution and live
event observation. It reaches L0 for bounded work submission and terminal result collection, and L1
for ordered JSONL observation of thread, turn, item, and error events.

`codex exec resume` provides durable conversation continuation for saved non-interactive sessions,
which is useful for staged pipelines. However, current evidence does not prove active reconnect,
pending request durability, or owned-session recovery semantics strong enough for L5 recovery flows.

Top-level `codex resume` is primarily an interactive TUI continuation surface. It can include
non-interactive sessions in its picker with `--include-non-interactive`, but that makes it a
human-facing continuation UI, not a provider-native non-interactive observation or request-answer
channel.

The CLI surfaces do not currently satisfy the stronger Agent Execution capabilities without more
evidence or a wrapper:

- no proven provider-native approval/request relay in `exec --json`;
- no proven structured approval answer channel;
- no proven durable pending-request answer channel;
- no proven active-stream reconnect or replay cursor;
- no proven protocol-level interrupt/cancel separate from process termination;
- no proven structured tool exit code in JSONL item events;
- no provider-emitted ownership class.

The safe integration posture is: use `codex exec --json` as an L0/L1 final-result and live-events
runner, use `codex exec resume` only as saved-session continuation, and gate all L2-L5 powers behind
fresh live probes.

## Brief contrast with MCP server and app server

The CLI reference lists `codex mcp-server` and `codex app-server` as separate protocol surfaces.
`mcp-server` is for another agent consuming Codex over MCP. `app-server` is experimental and can use
JSONL-over-stdio, WebSocket, or Unix socket transports. Those surfaces are more likely to expose
bidirectional protocol methods, but they are outside this report's scope. Their existence should not
be treated as evidence that `codex exec --json` has equivalent request, control, or reconnect
semantics.

## Surface summary

| Field | Assessment |
|---|---|
| Provider surface | Codex CLI local non-interactive and resume surfaces. |
| Version and platform | `codex-cli 0.141.0`; macOS 26.5.1; Darwin 25.5.0; arm64. |
| Configuration model | CLI flags, `-c key=value`, profiles, `CODEX_HOME`, config files, sandbox/approval flags, output flags. Effective config is not fully emitted in documented `--json` examples. OTel can record model, sandbox, approval, CLI version, and conversation id when configured. |
| Submission model | `codex exec [PROMPT]`, stdin, prompt-plus-stdin, `codex exec resume [SESSION_ID] [PROMPT]`, `codex exec resume --last`, and interactive `codex resume`. |
| Identity model | Documented JSONL includes `thread.started.thread_id`; item events include `item.id`; resume accepts session UUID or name. Turn id/request id stability is not proven by docs/help. |
| Ownership model | A wrapper can know it launched the process, but the CLI JSONL examples do not emit `owned`, `owned-remote`, or `observe-only`. `--last` and top-level resume can select human-created sessions unless constrained. |
| Observation model | Final stdout, stderr progress, `--json` JSONL stdout event stream, `-o/--output-last-message`, saved local sessions under `CODEX_HOME`. No documented snapshot/poll API for this surface. |
| State model | `turn.started`, `turn.completed`, `turn.failed`, `item.*`, and `error` permit partial classification. Running is inferred; request-waiting, interrupted, lost, and cancelled need probes. |
| Request model | CLI docs explain approval policies, but `exec --json` docs do not document structured request events or programmatic answer shapes. Non-interactive operation should be configured to avoid prompts or fail closed. |
| Control model | No documented provider protocol control for `exec --json`. Process signals and pipe closure are Execution Host concerns, not Agent protocol control. Top-level TUI has human controls such as Ctrl+C. |
| Resume/reconnect model | `codex exec resume` continues a saved session by id or `--last`; top-level `codex resume` reopens interactive sessions and can include non-interactive sessions. Active reconnect to a running `exec --json` stream is not documented. |
| Tool activity model | JSONL item events include command executions, file changes, MCP tool calls, web searches, and plan updates. Sample `command_execution` has item id, command, and status. Exit code presence is not documented in the sample. |
| Artifact/data model | Final stdout, JSONL stream, final-message file, OTel logs, and local session transcripts can be captured as evidence. Raw event streams and transcripts must be routed through kit-owned artifact/redaction storage. |
| Error model | JSONL includes `error`; documented turn events include `turn.failed`; CLI exits non-zero for some failures. Normalized provider error categories require wrapper mapping and probes. |
| Capability level | L0/L1 generally; resume continuation has a narrow L5-like persistence property for saved conversations, but not for active reconnect or pending requests. |

## Capability levels by functional area

| Functional area | Level | Rationale |
|---|---:|---|
| New non-interactive run submission | L0 | `codex exec` starts bounded work and returns a terminal result. |
| JSONL observation | L1 | `--json` streams event JSONL with thread, turn, item, and error events. |
| Request awareness | L0 to unknown | Approval concepts exist, but no documented structured request event in `exec --json`. |
| Request answering | L0 | No documented non-interactive answer channel after launch. |
| Saved-session continuation | L3 to L5, narrow | `codex exec resume` can continue prior saved sessions, but ownership, pending-request durability, and active reconnect are unproven. |
| Protocol control | L0 | No documented structured interrupt/cancel/steer API for these CLI surfaces. |
| Process control | Not Agent-owned | Signals, hard kill, containment, and process tree proof belong to Execution Host. |
| Tool activity visibility | L1 | JSONL item events expose command/file/tool activity classes and item ids; structured exit code needs a live probe. |
| Artifacts/evidence | L1 | Streams, final message files, OTel, and local session files are capturable, but artifact refs/redaction are wrapper responsibilities. |
| Capability discovery | L0 | Version/help output and docs reveal available flags; no provider-native capability attestation. |

## Requirement assessment

| Requirement | Supported? | Level | How / output shape | References | Caveats | Required probes |
|---|---|---:|---|---|---|---|
| AGP-FR-01 Configure | Partial | L0/L1 | `codex exec` accepts `--model`, `--profile`, `--sandbox`, `--ask-for-approval`, `--cd`, `--add-dir`, `-c key=value`, `--output-schema`, `--json`, `--ignore-user-config`, `--ignore-rules`, and `--ephemeral`. `CODEX_HOME` changes state root. OTel can include CLI version, conversation id, model, sandbox, and approval settings. | Manual CLI flags lines 4182-4208; non-interactive permissions lines 8995-9008; OTel lines 2511-2551; environment lines 9531-9564; local `codex exec --help`. | Documented `--json` sample does not emit a complete effective config object. Config may also be changed by managed requirements or defaults. | Run a harmless `codex exec --json --ignore-user-config -c ...` smoke in a temp repo and verify what config appears in JSONL, session files, and OTel. |
| AGP-FR-02 Submit work | Yes | L0 | New run: `codex exec "task"`. Stdin: `cmd \| codex exec "instruction"` or `codex exec -`. Continue: `codex exec resume --last "next task"` or `codex exec resume <SESSION_ID> "next task"`. Interactive continue: `codex resume [SESSION_ID] [PROMPT]`. | Manual non-interactive lines 8949-8993 and 9113-9123; CLI features lines 5570-5586; local help for `exec`, `exec resume`, and `resume`. | Submission is explicit, but boundedness is prompt/config discipline; the provider does not enforce kit task scope by itself. | Live smoke in disposable repo for prompt argument, stdin, prompt-plus-stdin, and resume by captured id. |
| AGP-FR-03 Identify | Partial | L1 | JSONL sample starts with `{"type":"thread.started","thread_id":"..."}`. Item events include `item.id`; resume accepts session UUID or session/thread name. | Manual JSONL lines 9018-9030; resume docs lines 5574-5577 and 9115-9123; local `exec resume --help`. | Turn ids are not shown in the sample. Request ids are not documented for this surface. Session names are ambiguous; UUIDs take precedence. | Capture JSONL for a run with multiple tool items and resume it; verify thread id stability, item id uniqueness, turn identifiers, and session file linkage. |
| AGP-FR-04 Ownership | Partial | L0 | A control-plane wrapper can know it launched a local `codex exec` process and captured its `thread_id`. Top-level `resume` and `--last` can reopen local saved sessions. | Local help: `codex exec`, `codex exec resume`, `codex resume`; manual resume lines 5570-5586. | CLI output does not state `owned`, `owned-remote`, or `observe-only`. `--last` can select the wrong session if not constrained by cwd/session id. Top-level `codex resume` is human-facing. | Use only explicit session ids captured from kit-launched runs; prove `--all`, cwd filtering, and session names cannot cross ownership boundaries unexpectedly. |
| AGP-FR-05 Observe | Partial | L1 | Plain mode streams progress to stderr and final message to stdout. `--json` makes stdout a JSONL stream of events. `-o` writes the final message to a file. | Manual lines 8971-8977 and 9010-9033; local `codex exec --help`. | No documented snapshot, poll, subscription, or transcript-read API for this CLI surface. Saved session files exist, but their schema is not documented as a provider contract. | JSONL smoke for long enough run to observe event order, stderr/stdout separation, and final-message file behavior. |
| AGP-FR-06 Wait | Partial | L0/L1 | A runner can wait on process exit or read JSONL until `turn.completed`, `turn.failed`, or `error`. | Manual JSONL event types lines 9018-9030. | No provider-native filtered wait for completion, request, progress, terminal state, or cursor. A wrapper reading lines is not the same as a provider wait API. | Implement a wrapper wait probe that blocks for first event, item progress, terminal event, and process exit; compare semantics. |
| AGP-FR-07 Order and reconnect | Partial | L1 | JSONL line order provides stream order during one live process. Item ids provide some correlation. | Manual JSONL sample lines 9024-9030. | No documented sequence ids, cursors, replay API, or missed-event recovery for active `exec --json`. Saved transcripts may help after completion but are not documented as a replay stream. | Kill and restart an observer around a long run under host containment; determine whether any active stream can be reattached or replayed without loss. |
| AGP-FR-08 Classify state | Partial | L1 | `turn.started` implies running; `turn.completed` implies completed; `turn.failed` and `error` imply failed/provider-error. Process exit status adds terminal evidence. | Manual event type list lines 9018-9020; local help and process behavior. | Waiting-for-input, cancelled, interrupted, lost, and terminal-ambiguous are not documented as normalized states for this CLI surface. | Probe success, model/API error, blocked approval, SIGINT, SIGTERM, network/auth failure, and stdout pipe break; map JSONL plus exit codes to normalized states. |
| AGP-FR-09 Surface requests | Unknown/partial | L0/L1 | Codex has approval policies and can ask before crossing sandbox or tool boundaries in interactive contexts. `exec --json` docs do not show request events. | Approval docs lines 1681-1698, 1847-1855, 2087-2109; JSONL item type docs lines 9018-9020. | A hidden approval prompt in non-interactive mode would be unsafe. Without documented request events, the integration must treat request awareness as unproven. | Trigger a sandbox/network/file approval under `codex exec --json --ask-for-approval on-request` in a disposable repo; see whether JSONL emits a structured request or fails closed. |
| AGP-FR-10 Answer requests | No/unknown | L0 | No documented non-interactive stdin/control channel for answering a request after `codex exec --json` has started. Top-level TUI can let a human answer interactively, but that is not a provider API for kit. | Local `codex exec --help`; top-level CLI feature docs lines 5558-5568. | Passing all input at launch or resuming with a new prompt is not the same as answering a specific pending request id. | If AGP-FR-09 probe finds request events, attempt allow/deny/input answers through any documented channel; otherwise mark unsupported. |
| AGP-FR-11 Request durability | Unknown | L0 | Resume docs say resumed runs keep the original transcript, plan history, and approvals. | Manual lines 5581-5586. | This does not prove a pending approval/request answer channel survives disconnect, human latency, or resume. "Approvals" may mean history, not live pending requests. | Park a pending request, terminate observer, resume by session id, and verify whether the exact request id can still be answered. |
| AGP-FR-12 Control | No/partial | L0 | Top-level interactive CLI has human controls such as Ctrl+C and `/exit`. `codex exec --json` has no documented provider protocol action for interrupt, cancel, steer, or stop-observing. | CLI feature lines 5558-5568; local help. | OS signals and process termination are Execution Host controls, not Agent protocol controls. A follow-up prompt through `exec resume` is continuation, not live steering. | Probe SIGINT/SIGTERM behavior separately under Execution Host; do not claim Agent control unless JSONL or CLI exposes a structured protocol action. |
| AGP-FR-13 Separate protocol control from process control | Partial | L0 | Docs distinguish sandbox/approval behavior for spawned commands, while the Agent design assigns process containment/kill to Execution Host. | Sandbox lines 1953-1976; Agent design boundaries in `README.md`; local CLI help. | The CLI surface itself does not emit proof that protocol stop differs from process kill, because no protocol stop is documented. | Execution Host parentage and signal probes must remain outside the Agent provider capability claim. |
| AGP-FR-14 Reconnect | No/partial | L0/L5 narrow | `codex exec resume` can continue a previous saved session; top-level `codex resume` can reopen saved sessions. | Manual lines 5570-5586 and 9113-9123; local `resume --help`. | This is continuation after a saved session, not documented observer reconnect to an owned active run. No active stream cursor or subscription reconnect is documented. | Start a long run, disconnect the observer without killing worker if possible, then test reattach. If impossible, mark active reconnect unsupported. |
| AGP-FR-15 Resume or continue | Partial/yes | L3-L5 narrow | `codex exec resume --last "..."` and `codex exec resume <SESSION_ID> "..."` continue a prior non-interactive session. Top-level `codex resume --include-non-interactive` can include non-interactive sessions in the picker/selection. | Manual lines 9113-9123; CLI features lines 5570-5586; local `codex resume --help`. | Resume does not prove ownership. `--last` is risky in shared `CODEX_HOME`; use explicit ids. Local `codex exec resume --help` does not list `--cd`/`--add-dir` at the subcommand level, while the manual says resumed runs can override cwd/add roots. | Live two-stage pipeline smoke with explicit session id, isolated `CODEX_HOME`, and cwd/add-dir parser probes before depending on environment steering. |
| AGP-FR-16 Tool activity visibility | Partial | L1 | JSONL item types include command executions, file changes, MCP tool calls, web searches, plan updates, agent messages, and reasoning. Sample command item includes `id`, `type`, `command`, and `status`. OTel can record tool decisions/results with duration, success, and output snippet. | Manual lines 9018-9029 and 2539-2551. | Sample does not show `exitCode`, cwd, complete output refs, or stable request ids. OTel snippets are not a full evidence channel. Do not claim `emitsStructuredToolExit` yet. | Prompt a command with known success and failure; inspect `item.completed` JSONL for command, cwd, status, exit code, output, and item id stability. |
| AGP-FR-17 Artifacts and evidence | Partial | L1 | Evidence can be retained from JSONL stdout, final stdout, stderr progress, `--output-last-message`, OTel, and local session files under `CODEX_HOME`. | Manual lines 8971-8977, 9010-9033, 2511-2551, 9531-9535; local help. | Provider does not emit kit `ArtifactRef`s. Raw streams may be large or sensitive. Wrapper must store redacted artifacts and reference them by digest/id. | Build artifact sink probe: capture JSONL/final/stderr/session metadata, redact, hash, and verify replayable references. |
| AGP-FR-18 Data handling | Partial | L0/L1 | Docs warn to scope `CODEX_API_KEY` to one `codex exec` invocation; `CODEX_HOME` stores config/auth/logs/sessions; OTel redacts user prompts unless `log_user_prompt=true`; auth/data policy depends on ChatGPT vs API key auth. | Manual lines 9073-9092, 2511-2519, 2557-2570, 9531-9564. | JSONL event output may include prompts, commands, file diffs, command output, paths, or model text. The CLI does not provide a documented redacted JSONL mode. | Probe representative JSONL for secrets/path exposure using synthetic canary values in an isolated repo; verify wrapper redaction before event-log ingestion. |
| AGP-FR-19 Error model | Partial | L0/L1 | JSONL event types include `error`; turn events include `turn.failed`; CLI exits with errors for some setup failures such as required MCP initialization failure. | Manual lines 9006-9008 and 9018-9020; local help. | Launch failed, stream lost, request channel lost, resume failed, control unsupported, terminal ambiguous, and provider unavailable are not normalized by the documented CLI surface. | Probe auth missing, bad config with `--strict-config`, invalid session id, required MCP failure, model/API failure, stream pipe close, and interrupted process. |
| AGP-FR-20 Capability discovery | Partial | L0 | `codex --version`, local help, command list, `codex features`, and `codex doctor` can reveal local availability/config health. | Local help; CLI command overview lines 4216-4249. | No documented machine-readable Agent capability report for this exact surface, version, config, ownership, and platform. Help proves availability only. | Create a conformance probe that records version, platform, help hash, feature list, config posture, and live smoke results as capability attestations. |
| AGP-FR-21 Conformance evidence | Partial | L0 | Documentation and local help support an initial probe plan. No live smoke, request, persistence, or parentage evidence was collected in this research pass. | Agent conformance file; Codex manual/helper output; local help. | Schema/help/docs evidence cannot unlock request relay, durable answers, structured tool exit, active reconnect, or process parentage. | Run the probe suite listed below before using this provider for unattended or recovery-sensitive flows. |

## Local command shapes observed

These are local-help shapes, not live model probes:

```bash
codex exec --json "summarize the repo structure"
```

Documented JSONL shape:

```jsonl
{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}
{"type":"turn.started"}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"bash -lc ls","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"Repo contains docs, sdk, and examples directories."}}
{"type":"turn.completed","usage":{"input_tokens":24763,"cached_input_tokens":24448,"output_tokens":122,"reasoning_output_tokens":0}}
```

```bash
codex exec resume --last --json "fix the race conditions you found"
codex exec resume <SESSION_ID> --json "continue from the prior plan"
codex resume --include-non-interactive --last
```

Local help for `codex exec resume` accepts `SESSION_ID` as UUID or thread name, `--last`, `--all`,
`--json`, `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, `--output-schema`, `-o`, `-m`,
`-i`, `-c`, `--enable`, `--disable`, and risky bypass flags. Local help for top-level
`codex resume` accepts `--include-non-interactive`, `--remote`, `--cd`, `--add-dir`, sandbox, model,
profile, approval, search, and remote auth flags.

## Required conformance probes before stronger capability claims

1. Help/config discovery probe: record `codex --version`, platform, `codex exec --help`,
   `codex exec resume --help`, `codex resume --help`, `codex features`, and effective config inputs.
2. New-run JSONL smoke: in an isolated temp Git repo and isolated `CODEX_HOME`, run a read-only
   `codex exec --json` task and capture stdout JSONL, stderr, exit code, session files, and final
   message behavior.
3. Tool event probe: ask Codex to run a known successful command and a known failing command; verify
   whether JSONL includes command, cwd, status, exit code, output, and stable item ids.
4. Terminal classification probe: force completed, failed, auth/config failure, invalid schema,
   invalid session id, SIGINT, SIGTERM, and stdout pipe-close cases.
5. Approval/request probe: under restrictive sandbox/approval settings, trigger file, command,
   network, and tool approval situations and verify whether `exec --json` emits structured request
   events or fails closed.
6. Request answer probe: only if request events exist, attempt approve, decline, cancel, and input
   answers through a documented provider channel; otherwise record unsupported.
7. Request durability probe: park a pending request, wait, disconnect/restart the observer, resume
   explicitly by session id, and test whether the same request id can still be answered.
8. Resume continuation probe: run a two-stage `codex exec` pipeline, capture `thread_id`, resume by
   explicit id, and verify transcript/context continuity without using `--last`.
9. Active reconnect probe: start a long-running observable turn, intentionally detach the observer,
   and determine whether the stream can be reattached or replayed. If not, mark active reconnect
   unsupported.
10. Ownership probe: prove that explicit captured session ids remain scoped to the kit-owned
    `CODEX_HOME` and cwd; prove that `--last`, names, and `--all` do not cross into human sessions in
    the intended deployment.
11. Data-handling probe: inject synthetic canary secrets/paths in a disposable repo and verify what
    appears in JSONL, stderr, final output, session files, OTel, and logs.
12. Process boundary probe: under Execution Host containment, prove process parentage and signal
    behavior independently from Agent provider events.

## Integration recommendation

Treat these CLI surfaces as a weak but useful provider:

- Claim L0 for submit-and-final-result after a minimal live smoke.
- Claim L1 for event observation only after JSONL event and terminal probes pass.
- Claim saved-session continuation only for explicit kit-captured session ids in an isolated
  `CODEX_HOME`.
- Do not claim `canRelayApproval`, `canPersistApprovalAnswerChannel`, `canResumeOwned` for recovery,
  `emitsStructuredToolExit`, or protocol control until the required probes produce positive
  evidence.
- Route raw JSONL, stderr, stdout, final message files, OTel, and session transcripts through a
  kit-owned artifact sink with redaction and digest references before recording event-log evidence.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../README.md) · **← Prev:** [Codex CLI agent provider research report](./codex-cli-agent-provider-report.md) · **Next →:** [Codex MCP Agent provider research report](./codex-mcp-agent-provider-report.md)

<!-- /DOCS-NAV -->
