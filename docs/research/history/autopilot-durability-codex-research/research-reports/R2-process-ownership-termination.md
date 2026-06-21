# R2 - Child Execution Ownership and Termination

## Executive Recommendation

Adopt a runner-owned process containment handle for every worker: on POSIX, launch the child as a new session/process-group leader and terminate the whole group; on Linux, prefer cgroup v2 or a transient systemd scope when available for stronger containment and empty-cgroup proof; on Windows, use a Job Object. Confidence: high for the required model, medium for the exact platform adapter mix because macOS lacks a cgroup/job-object equivalent and Node.js does not expose every OS primitive directly.

## Sources Checked

- Local charter: `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18. Defines the R2 question and required report format.
- Local durability overview: `docs/autopilot-durability/README.md`, checked 2026-06-18. Establishes that Theme D is live-child control and killability.
- Local design spine: `docs/autopilot-durability/design/00-overview.md`, checked 2026-06-18. Defines ownership as process tree, protocol handle, session linkage, event writer, timers, and recovery authority.
- Local D2 draft: `docs/autopilot-durability/design/02-lifecycle-and-control-plane.md`, checked 2026-06-18. Proposes owned process group/session, interrupt to kill ladder, and no-descendant verification.
- Local runtime findings: `docs/autopilot-durability/design/notes/codex-runtime-findings.md`, checked 2026-06-18. Confirms current kit retains no child process handle and that reliable kill requires kit-owned process ownership.
- Node.js `child_process` documentation, v26.3.1, checked 2026-06-18: https://nodejs.org/api/child_process.html. Primary source for Node spawn, `detached`, `timeout`, `AbortSignal`, and `subprocess.kill()` behavior.
- Linux `kill(2)` manual, man-pages 6.18, checked 2026-06-18: https://man7.org/linux/man-pages/man2/kill.2.html. Primary source for signaling process groups with negative PIDs and existence checks with signal 0.
- Linux `setsid(2)` manual, man-pages 6.18, checked 2026-06-18: https://man7.org/linux/man-pages/man2/setsid.2.html. Primary source for creating a session and process group leader.
- Linux `setpgid(2)` manual, man-pages 6.18, checked 2026-06-18: https://man7.org/linux/man-pages/man2/setpgid.2.html. Primary source for process-group membership and inheritance across fork/exec.
- Linux `wait(2)` / `waitpid(2)` manual, man-pages 6.18, checked 2026-06-18: https://man7.org/linux/man-pages/man2/waitpid.2.html. Primary source for reaping, zombie semantics, and waiting by process group for children.
- Linux `PR_SET_CHILD_SUBREAPER`, man-pages 6.18, checked 2026-06-18: https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html. Primary source for reparenting orphaned descendants to a subreaper.
- Linux `PR_SET_PDEATHSIG`, man-pages 6.16, checked 2026-06-18: https://man7.org/linux/man-pages/man2/PR_SET_PDEATHSIG.2const.html. Primary source for parent-death signal limits.
- Linux kernel cgroup v2 documentation, checked 2026-06-18: https://docs.kernel.org/admin-guide/cgroup-v2.html. Primary source for cgroup process containment, `cgroup.procs`, and `cgroup.events populated`.
- Microsoft Job Objects documentation, checked 2026-06-18: https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects. Primary source for Windows process-tree management and default child association.
- Microsoft `TerminateJobObject`, checked 2026-06-18: https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject. Primary source for terminating all processes in a job and child-job hierarchy.
- Microsoft `AssignProcessToJobObject`, checked 2026-06-18: https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject. Primary source for assigning workers to jobs and nested-job/breakaway limits.
- Microsoft `QueryInformationJobObject` and `JOBOBJECT_BASIC_PROCESS_ID_LIST`, checked 2026-06-18: https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-queryinformationjobobject and https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_process_id_list. Primary source for querying active processes in a Windows job.
- systemd transient settings, checked 2026-06-18: https://systemd.io/TRANSIENT-SETTINGS/. Established supervisor pattern for transient scope/service units with `RuntimeMaxSec`, `TimeoutStopSec`, `KillMode`, `SendSIGKILL`, and related kill settings.

## Findings

Facts from sources:

- Node's `subprocess.kill()` sends a signal to the immediate child process. Node explicitly warns that on Linux, child processes of child processes are not terminated when killing their parent, especially with shells or `shell: true`.
- Node's `timeout`, `AbortSignal`, and `killSignal` options stop the spawned process, not the full descendant tree. They are useful as one input to a supervisor, not sufficient as the ownership contract.
- Node's `detached: true` has platform-specific behavior. On non-Windows platforms it makes the child leader of a new process group and session. On Windows it creates an independent child with its own console behavior; it is not the same as a Windows Job Object.
- POSIX/Linux `setsid()` creates a new session and makes the caller the process group leader, with PGID equal to PID. Children inherit session and process group across fork/exec unless they explicitly change them.
- `kill(pid < -1, sig)` sends the signal to every process in the process group whose ID is `-pid`. `kill(-pgid, 0)` can check existence/permission for the process group without sending a signal.
- `waitpid(-pgid, ...)` or `waitid(P_PGID, ...)` can reap children in a process group, but only children of the calling process. Grandchildren that become orphaned are not waitable by the original parent unless a subreaper or equivalent is involved.
- Zombies are not live workers, but unreaped child zombies still consume process-table slots. A correct supervisor must both terminate live members and reap direct children.
- Linux `PR_SET_CHILD_SUBREAPER` lets a supervisor act like an init process for orphaned descendants, so orphaned descendants are reparented to it and can be waited on. This is Linux-specific and not inherited by forked children.
- Linux `PR_SET_PDEATHSIG` only sends a signal to the process when its parent thread dies. Its setting is cleared for forked children, so it is not a full descendant-tree cleanup mechanism.
- cgroup v2 is a kernel mechanism for hierarchical process grouping. Every process belongs to one cgroup; `cgroup.procs` lists members, and `cgroup.events` has a recursive `populated` flag that becomes 0 when the cgroup and descendants have no live processes.
- Windows Job Objects are the Windows-native unit for managing process groups. By default, child processes created by a process in a job are also associated with the job unless breakaway is allowed. `TerminateJobObject` terminates all associated processes and nested child jobs.
- Windows can query job membership with `QueryInformationJobObject(JobObjectBasicProcessIdList)`. Job assignment has compatibility limits: older Windows versions did not support nested jobs, and already-jobbed processes can fail assignment depending on OS version and job settings.
- systemd's transient unit surface exposes process killing settings such as `KillMode`, `SendSIGKILL`, `KillSignal`, `FinalKillSignal`, `TimeoutStopSec`, and `RuntimeMaxSec`. This is an established supervisor pattern: terminate a whole unit/cgroup, wait a bounded grace period, then send a final uncatchable signal.

Interpretation for workflow-kit:

- Immediate PID ownership is necessary but not sufficient. `workflow-autopilot` workers run CLIs that spawn shells, package managers, test runners, git/gh, language servers, and possibly dev servers. A pid-only kill will leave exactly the kind of orphaned descendants seen in the incidents.
- POSIX process-group/session ownership is the portable minimum for macOS and Linux. It covers ordinary descendants that inherit the group, which is the normal behavior for shell/package-manager/test-runner trees.
- Process groups are not adversarial containment. A descendant can intentionally call `setsid()` or `setpgid()` and escape the original group. For untrusted or daemonizing tools, a cgroup, container, sandbox, or Windows Job Object is the stronger primitive.
- Reaping and proof are separate from signaling. Sending `SIGKILL` to a group says termination was requested; it does not by itself prove every descendant is gone. Proof needs process membership enumeration and a bounded empty-state check.
- Parent crash is not solved by process groups. If the supervisor dies before sending signals, process-group members can keep running. Linux cgroups managed by systemd scopes, Windows Jobs with kill-on-close, or recovery on next startup from recorded containment IDs are stronger crash-recovery paths.

## Options

### Option A - Immediate child PID only

Spawn the child with Node and use `AbortSignal`, `timeout`, `subprocess.kill()`, or transport close on terminal paths.

Enables:

- Simple implementation using existing Node APIs.
- Immediate child can be stopped in many common cases.
- Works uniformly enough across POSIX and Windows for a single process.

Cannot do:

- Does not reliably stop grandchildren, shell pipelines, package-manager children, test servers, or daemonized helpers.
- Cannot prove no descendants survive.
- Recreates the failure class in Theme D and should not unlock `auto-merge`, `auto-recover`, or unattended runs.

### Option B - POSIX process group/session containment floor

On POSIX, spawn the worker as a new session/process-group leader, retain the `ChildProcess` handle, record PID/PGID/SID and start time, and signal the negative PGID on terminal paths.

Enables:

- Covers the normal full worker tree for shell/package-manager/test-runner descendants that inherit PGID/SID.
- Available on macOS and Linux through standard process semantics; Node's `detached: true` creates the new session/process group on non-Windows.
- Supports a bounded ladder: protocol interrupt, `SIGTERM` to `-pgid`, grace wait, `SIGKILL` to `-pgid`, reap, enumerate, and retry/check empty.

Cannot do:

- Does not prevent deliberate or tool-driven escape via `setsid()`/`setpgid()`.
- Does not automatically clean up if the parent process crashes before termination.
- Cannot reap arbitrary grandchildren unless they remain children, are reparented to a Linux subreaper, or are managed by an external init/supervisor.
- Needs careful PID-reuse handling: record PID start time and avoid signaling a reused PGID after the original group is gone.

### Option C - Kernel/supervisor containment where available

Use platform-native containment around the process group: Linux cgroup v2 or a transient systemd scope/service; Windows Job Object with no breakaway and kill-on-close where possible. Keep POSIX process-group signaling inside the containment as the portable floor.

Enables:

- Strongest proof of no live descendants: Linux cgroup `populated=0` / empty `cgroup.procs`; Windows job process list empty or job signaled.
- Better parent-crash behavior when delegated to systemd or Job Object kill-on-close.
- Standard supervisor semantics for runtime limit, stop timeout, TERM-to-KILL escalation, accounting, and process-count/resource limits.
- Handles descendants even if they no longer share the original PGID, as long as they cannot escape the cgroup/job.

Cannot do:

- Not universally available from an unprivileged CLI on macOS or all Linux environments.
- Adds platform adapters or a small native/helper layer; Node stdlib does not expose cgroup creation or Windows Job Object APIs directly.
- cgroup delegation and systemd user-manager availability vary across CI, containers, and developer machines.
- Windows breakaway/nested-job behavior is version- and policy-dependent.

### Option D - External container or sandbox runner

Run each worker in a container, VM, or sandbox namespace and destroy that container on terminal paths.

Enables:

- Strongest isolation and cleanup boundary when available.
- Natural place to enforce network, filesystem, package-manager, and process limits.

Cannot do:

- Heavyweight for a repo-local OSS CLI and likely unavailable on many developer machines.
- Complicates filesystem/worktree access, credentials, interactive approvals, and local tool reuse.
- Better treated as a future hardened profile than the baseline for vNext.

## Recommendation

Implement a `ProcessContainment` driver contract and make it a required capability for side-effectful child execution. The contract should not expose only `pid`; it should expose a containment handle:

- `platform`: `posix-process-group`, `linux-cgroup-v2`, `systemd-scope`, `windows-job`, or `immediate-only`.
- `rootPid`, `rootStartTime`, `pgid`, `sid` where applicable.
- `cgroupPath` or `systemdUnit` where applicable.
- `jobHandle` or job name/process-list capability where applicable.
- `containmentStrength`: `kernel-tree`, `process-group-tree`, or `immediate-process`.
- `canSignalTree`, `canEnumerateTree`, `canProveEmpty`, `canReapChildren`, and `survivesSupervisorCrash` capability flags.

For POSIX launch:

1. Spawn through a small owned launcher path that creates a new session/process group before exec. In Node-only phase, use `spawn(..., { detached: true, stdio: pipe-or-log-file })` on non-Windows and keep the `ChildProcess` referenced; do not `unref()` for supervised work.
2. Record PID, PGID, SID, command, cwd, start time, and containment ID in the append-only event log as launch facts.
3. Keep stdout/stderr drained or redirected to files so pipe backpressure cannot stall the child.
4. Prefer not to run via `shell: true`. If shell is necessary, the shell must be the session/process-group leader and the whole group remains the termination target.

For Linux:

- Prefer a transient systemd scope/service or delegated cgroup v2 when available. Put the worker process into that containment before untrusted work begins.
- Use process-group signaling inside the cgroup for graceful shutdown, but use cgroup emptiness as the proof.
- If the supervisor is a native/helper process, consider `PR_SET_CHILD_SUBREAPER` so double-forked descendants can be reaped by the supervisor. Treat it as an enhancement, not the primary containment boundary.

For Windows:

- If Windows support is in scope, do not rely on Node `detached` or process-kill semantics for tree ownership. Use a small native helper or dependency that creates a Job Object, assigns the worker before resume, prevents breakaway where compatible, sets kill-on-job-close if safe, and exposes job process-list queries.
- If Job Object creation/assignment fails, mark the run `control-degraded` and block autonomous capabilities that require full-tree termination.

For every terminal path (`no-progress`, `max-runtime`, `operator-abort`, `supervision-lost`, parent-directed cancellation, failed launch cleanup):

1. Persist a `termination-requested` event with reason and containment handle.
2. Stop accepting new work for that child and close approval/progress waiters.
3. Attempt protocol-native graceful interrupt if the driver supports it; time-box it.
4. Send graceful OS termination to the full containment target: `SIGTERM` to `-pgid`, systemd stop, cgroup kill/TERM helper, or job-level graceful equivalent where available.
5. Wait a configured grace window while draining events and reaping direct children.
6. Escalate to final kill: `SIGKILL` to `-pgid`, cgroup kill/final signal, `TerminateJobObject`, or systemd final kill.
7. Reap all waitable children until no more matching children remain.
8. Enumerate containment membership and require proof empty before declaring termination complete.
9. If membership is not empty after the hard deadline, emit `termination-unverified` with surviving PIDs/commands and disable recovery/merge automation for the run.

Recommended default timings:

- Graceful protocol interrupt: 5-15 seconds.
- `SIGTERM` grace: 10-30 seconds by repo config, default 15 seconds.
- Final `SIGKILL` wait: 2-5 seconds, then poll membership until hard deadline.
- Overall termination hard deadline: 60 seconds default, configurable per repo/runner profile.

The capability gate should distinguish:

- `killable: false`: immediate-pid only or unowned; autonomous merge/recovery disabled.
- `killable: process-group`: POSIX process group/session with enumeration proof; acceptable baseline for trusted local CLI workers on macOS/Linux.
- `killable: kernel-tree`: cgroup/systemd/job object with empty-containment proof; preferred for unattended and high-confidence automation.

## Tradeoffs and Risks

- POSIX process groups are pragmatic and portable, but not absolute containment. A tool that daemonizes into a new session can escape. The runner must detect and report residual descendants where possible instead of claiming certainty.
- cgroup/systemd integration is stronger but not always available to unprivileged users. User managers, cgroup delegation, containers, and CI images differ.
- Windows Job Objects are the right primitive, but require native API access that Node stdlib does not provide. A helper binary increases packaging and test burden.
- `SIGKILL` is reliable for termination but not graceful. It can leave lockfiles, partial installs, temp dirs, and corrupt transient caches. The ladder must prefer scoped graceful interrupt/TERM first.
- Reaping only direct children is easy; reaping orphaned grandchildren requires subreaper behavior or external supervisor ownership. Do not equate `close` event on the root child with tree cleanup.
- Process enumeration can race with late forks during shutdown. The hard-kill phase should repeat enumeration after final signal and require stable-empty for a short interval.
- PID reuse is real. Recorded start times and containment IDs should be used for validation before sending late signals after recovery.
- Parent crash is a separate problem. Process groups alone do not clean up on parent death; startup recovery must scan recorded live containment handles and either terminate or mark operator-required.
- Some tools intentionally spawn long-lived helpers. The default policy should treat these as children of the worker and terminate them unless the repo explicitly grants an external daemon exception.

## Fallback and Degraded Modes

- If only an immediate PID is available, the driver may launch for manual/supervised work but must record `control-degraded: immediate-only`; no autonomous merge, auto-recover, or unattended run should be enabled.
- If process-group/session launch succeeds but tree-empty proof is unavailable, terminate the group and then perform best-effort `ps`/proc enumeration by PGID/SID. Record `termination-proof: best-effort`.
- If cgroup/systemd setup fails, fall back to POSIX process group and emit the exact reason (`no-systemd-user-manager`, `cgroup-not-delegated`, `permission-denied`, `inside-unsupported-container`, etc.).
- If Windows Job Object assignment fails because the process is already in an incompatible job, continue only in manual mode or fail closed before child side effects begin.
- If descendants survive the hard deadline, leave the run in `termination-unverified` or `operator-required` with command, PID, PPID, PGID/SID/cgroup/job evidence and suggested local kill command. Do not clear claims, relaunch, recover, or merge automatically.
- If the supervisor restarts and finds a recorded live containment handle, it should first verify whether the original root process/containment still exists. If yes, either reattach observe-only and request operator decision, or terminate if policy explicitly allows stale-run cleanup. If no live members exist, append a recovery event proving it is already empty.

## Validation Spikes

1. POSIX full-tree fixture: spawn a Node or shell worker that starts nested `sh`, `pnpm`-like sleep children, and a background process. Verify `SIGTERM -> SIGKILL` to `-pgid` leaves no process with that PGID/SID and that wait/reap drains zombies.
2. Escape fixture: child calls `setsid()` or starts a daemonized grandchild. Verify process-group mode detects degraded proof or surviving residual; verify cgroup/systemd mode still contains it when available.
3. Parent-crash fixture: kill the supervisor process mid-run. On restart, use recorded PID/PGID/SID/cgroup/job facts to find and clean up or mark operator-required. Compare process-group-only versus systemd/cgroup/job behavior.
4. Pipe-backpressure fixture: child floods stdout/stderr. Verify supervisor drains or redirects output and termination still completes.
5. Timeout matrix: exercise no-progress, max-runtime, approval timeout, operator abort, and supervision-lost. Assert every path emits termination events and ends in empty containment or `termination-unverified`.
6. Linux cgroup/systemd spike: launch the same worker in a transient scope or delegated cgroup. Prove `cgroup.events populated=0` after termination and record exact permission/setup requirements.
7. Windows spike, if supported: create a Job Object wrapper, assign the worker, spawn descendants, terminate the job, and query `JobObjectBasicProcessIdList` until empty. Capture nested-job and breakaway behavior on current supported Windows versions.
8. PID-reuse safety test: simulate stale launch metadata and ensure the runner refuses to signal a process whose PID start time or containment identity does not match.

## Open Questions

- Is Windows a vNext supported runner platform, or should Windows be documented as `control-degraded` until a Job Object helper is shipped?
- Should unattended/automerge require `kernel-tree` containment, or is `process-group-tree` plus post-kill enumeration sufficient for trusted local macOS developer workflows?
- Should workflow-kit ship a small native/helper launcher for POSIX `setsid`, Linux subreaper/cgroup helpers, and Windows Job Objects, or stay pure Node and accept weaker platform coverage initially?
- What default termination grace windows are acceptable for common repo verify commands that may need cleanup time?
- Should repos be able to whitelist intentionally persistent external daemons, and if so how should those be distinguished from leaked descendants without weakening the default invariant?
- Should parent-crash cleanup be automatic for stale owned workers, or should it always require operator confirmation unless the worker is in a kernel-owned containment unit that proves identity?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [R1 - Codex Runtime Control](./R1-codex-runtime-control.md) · **Next →:** [R3 - Approval and Permission Relay](./R3-approval-permission-relay.md)

<!-- /DOCS-NAV -->
