---
title: "Execution Host evidence appendix"
date: "2026-06-18"
domain: "prov-04-execution-host"
---

# Execution Host evidence appendix - 2026-06-18

This appendix records local evidence for `prov-04-execution-host/design.md`. It uses the allowed
kit-vnext inputs, same-domain outputs, and minimal live/local provider probes only. It does not read
legacy docs, call external APIs, or perform network research.

## Evidence artifacts

| Artifact | Purpose | SHA-256 |
|---|---|---|
| `2026-06-18-contract-schema-lines.out` | Contract/schema line snapshot from `design.md` and split contract detail | `5354b21ea4e5f6dd37c9c67d557aa0c4c13134d02125a861add6545eba5afb88` |
| `2026-06-18-local-command-capture.out` | Real local runner-command capture probe | `14ab01c0406988f68b72376c806e51bd152650a6fd722513d01ce38c22f3bdb3` |
| `2026-06-18-local-termination-probe.out` | Real local process-group termination probe | `ce6b92b73a940aa6431be57ac282c062ae185fac754462bf1074bce541ad51d0` |
| `2026-06-18-mock-host-probe-snapshot.json` | Mock host conformance probe snapshot | `9231f9e00ec3d9174644ae06ef2cb1d3037a9965ccb9aed7d8b3ac3d151c5d24` |
| `2026-06-18-mock-host-probe-snapshot.pretty.json` | JSON validation / normalized snapshot output | `ab0049ab4fca40254ea68d0eb438ede468aeb90d340bba084be0550ce40caeef` |

## Probe 1 - contract/schema snapshot

Command:

```bash
rg -n "type HostCapability|type HostFailureReason|interface WorkspaceAttachment|interface HostWorkspaceHandle|interface HostInjectionContext|interface WorkerLaunch|interface SpawnWorkerRequest|interface HostCommandRequest|interface CommandResult|interface WorkerHandle|type HostObservation|interface TerminationPolicy|interface TerminationProof|interface TerminationResult|interface HostReleaseResult|interface HostFailure|interface HostProbeScope|interface CapabilityAttestation|interface ExecutionHost|probeCapabilities\(|attachWorkspace\(|spawnWorker\(|observeWorker\(|terminateWorker\(|runCommand\(|releaseWorkspace\(" docs/kit-vnext/domains/prov-04-execution-host/design.md docs/kit-vnext/domains/prov-04-execution-host/design/contracts-and-conformance.md > docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-contract-schema-lines.out
shasum -a 256 docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-contract-schema-lines.out
sed -n '1,160p' docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-contract-schema-lines.out
```

Output snapshot: `2026-06-18-contract-schema-lines.out` is the exact schema snapshot artifact.
Current SHA-256: `5354b21ea4e5f6dd37c9c67d557aa0c4c13134d02125a861add6545eba5afb88`.

## Probe 2 - real local runner-command capture

Command:

```bash
out=docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-local-command-capture.out
tmp=docs/kit-vnext/domains/prov-04-execution-host/evidence/probe-workspace
rm -rf "$tmp"
mkdir -p "$tmp"
(
  cd "$tmp" || exit 98
  /bin/sh -c 'printf "cwd=%s\n" "$PWD"; printf "argv0=%s argv1=%s\n" "$0" "$1"; printf "stdout=ok\n"; printf "stderr=ok\n" >&2; exit 7' host-probe arg1
  printf "exit=%s\n" "$?"
) > "$out" 2>&1
shasum -a 256 "$out"
sed -n '1,80p' "$out"
```

Output snapshot:

```text
14ab01c0406988f68b72376c806e51bd152650a6fd722513d01ce38c22f3bdb3  docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-local-command-capture.out
cwd=/Users/aryekogan/repos/workflow-kit/docs/kit-vnext/domains/prov-04-execution-host/evidence/probe-workspace
argv0=host-probe argv1=arg1
stdout=ok
stderr=ok
exit=7
```

Result: this proves the local host can run a command in an attached directory and capture cwd, argv,
stdout, stderr, and non-zero exit evidence. It is a primitive probe, not a complete AD-2 helper.

## Probe 3 - real local process-group termination

Command:

```bash
out=docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-local-termination-probe.out
python3 - <<'PY' > "$out" 2>&1
import json
import os
import signal
import subprocess
import time

proc = subprocess.Popen(
    ["/bin/sh", "-c", "sleep 30 & echo child=$!; wait"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    start_new_session=True,
)
line = proc.stdout.readline().strip()
child_pid = int(line.split("=", 1)[1])
time.sleep(0.2)
os.killpg(proc.pid, signal.SIGTERM)
forced = False
try:
    proc.wait(timeout=3)
except subprocess.TimeoutExpired:
    forced = True
    os.killpg(proc.pid, signal.SIGKILL)
    proc.wait(timeout=3)
time.sleep(0.5)
ps = subprocess.run(["/bin/ps", "-p", str(child_pid), "-o", "pid="], capture_output=True, text=True, check=False)
child_alive = bool(ps.stdout.strip())
if child_alive:
    try:
        os.kill(child_pid, signal.SIGKILL)
    except ProcessLookupError:
        child_alive = False
result = {
    "child_alive_after_reap_check": child_alive,
    "child_pid_recorded": child_pid > 0,
    "containment_primitive": "process-group-session",
    "forced_kill_used": forced,
    "parent_exit_observed": proc.returncode is not None,
    "parent_pid_recorded": proc.pid > 0,
    "termination_signal": "SIGTERM",
}
print(json.dumps(result, sort_keys=True))
PY
shasum -a 256 "$out"
sed -n '1,80p' "$out"
```

Output snapshot:

```text
ce6b92b73a940aa6431be57ac282c062ae185fac754462bf1074bce541ad51d0  docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-local-termination-probe.out
{"child_alive_after_reap_check": false, "child_pid_recorded": true, "containment_primitive": "process-group-session", "forced_kill_used": false, "parent_exit_observed": true, "parent_pid_recorded": true, "termination_signal": "SIGTERM"}
```

Result: this proves a local process-group/session primitive can terminate a parent and child process
for this probe. It does not prove stronger `kernel-tree` or `job-object` containment and is not a
substitute for the Local driver's AD-2 helper conformance suite.

## Probe 4 - mock host snapshot

Command:

```bash
python3 -m json.tool docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-mock-host-probe-snapshot.json > docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-mock-host-probe-snapshot.pretty.json
shasum -a 256 docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-mock-host-probe-snapshot.json docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-mock-host-probe-snapshot.pretty.json
sed -n '1,120p' docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-mock-host-probe-snapshot.pretty.json
```

Output hashes:

```text
9231f9e00ec3d9174644ae06ef2cb1d3037a9965ccb9aed7d8b3ac3d151c5d24  docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-mock-host-probe-snapshot.json
ab0049ab4fca40254ea68d0eb438ede468aeb90d340bba084be0550ce40caeef  docs/kit-vnext/domains/prov-04-execution-host/evidence/2026-06-18-mock-host-probe-snapshot.pretty.json
```

Snapshot coverage: positive and negative `canKill`, all declared `containmentStrength` values,
structured tool exit capture, egress negative-probe success, and adversarial egress failure. The
snapshot also covers missing process exit, delayed output, false liveness, unproven termination,
missing output digest, missing redaction, and stale egress attestation.

## Evidence limitations and open risks

- No implemented AD-2 native helper was available in this design-only pass. The real local probes
  validate primitives only; driver conformance must still prove the helper's full signal, grace,
  force-kill, reap, and prove-empty ladder.
- No implemented real egress confinement driver was available, so no live negative egress block was
  treated as satisfied. Until a Local driver proves disallowed hosts are blocked with fresh
  `egress-confinement` attestations, the capability must be absent and credential injection must fail
  closed.
- The mock snapshot is a contract fixture, not runtime behavior. It is useful only if future driver
  tests hold the mock to the same contract fields and failure states as the Local driver.
