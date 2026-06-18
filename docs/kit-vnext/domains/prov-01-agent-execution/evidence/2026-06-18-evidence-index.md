---
title: "Agent Execution evidence index - 2026-06-18"
status: captured
codex-version: "0.141.0"
---

# Agent Execution evidence index - 2026-06-18

All files in this appendix were captured or generated for the prov-01 design session. The full
SHA-256 index is `2026-06-18-shasums.txt`.

## Commands run

```bash
command -v codex
codex --version
codex --help
codex mcp-server --help
codex app-server --help
codex app-server generate-json-schema --help
codex app-server generate-json-schema --experimental --out docs/kit-vnext/domains/prov-01-agent-execution/evidence/2026-06-18-codex-0.141.0-app-server-schema
```

MCP stdio probe:

```bash
node <<'NODE' > docs/kit-vnext/domains/prov-01-agent-execution/evidence/2026-06-18-probes/codex-mcp-server-line-json-probe.json
// Spawns `codex mcp-server`, sends initialize, initialized, and tools/list as newline-delimited
// JSON-RPC messages, then writes stderr and parsed responses.
NODE
```

Hash index command:

```bash
find docs/kit-vnext/domains/prov-01-agent-execution/evidence -type f ! -name '2026-06-18-shasums.txt' -print0 | sort -z | xargs -0 shasum -a 256 > docs/kit-vnext/domains/prov-01-agent-execution/evidence/2026-06-18-shasums.txt
```

## Captured facts

- `codex --version` returned `codex-cli 0.141.0`.
- CLI help lists `mcp-server` as "Start Codex as an MCP server (stdio)".
- CLI help lists `app-server` as experimental and exposes `generate-json-schema`.
- App-server schema generation succeeded with `--experimental`.
- The app-server generated schema includes `thread/start`, `thread/resume`, `turn/start`,
  `turn/steer`, `turn/interrupt`, typed command/file/permission approval requests, MCP
  elicitation requests, command execution items with `exitCode`, process exit notifications, and
  Guardian review notifications.
- The MCP line-json probe initialized `codex-mcp-server` version `0.141.0` and listed `codex` and
  `codex-reply` tools.

## Limitations

- No live Codex worker task was started for this design.
- No live approval request was triggered or answered.
- No live owned-session approval park/resume was proven.
- No live app-server command parentage probe was run with prov-04 containment.
- Guardian schema is present, but the captured schema marks review payloads unstable; Guardian is
  advisory only in this design.

## Mock fixtures

`2026-06-18-mock-adversarial-fixtures.jsonl` records the required adversarial fixture set:

- dropped approval;
- lost linkage;
- no exit code;
- claim without evidence.
