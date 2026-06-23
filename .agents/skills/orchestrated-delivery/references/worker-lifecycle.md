# Worker Lifecycle

Use this reference after package preflight and runtime binding. Workers execute packaged prompts and
report evidence; the coordinator owns all mutations and lifecycle decisions.

## Dispatch

- Default to isolated subagents. Use visible threads only when the user explicitly requests them and
  the surface supports them.
- Name each worker before launch with a short role alias, and record the alias in the ledger.
- Launch implementers only for dependency-ready stories. A dependency is ready for dispatch only when
  both its story commit and tracker evidence commit exist, and its implementer/reviewer pair is
  closed or marked terminal.
- Independent package stories may run concurrently from the first wave when pathsets do not conflict
  and active sessions remain below `worker-cap`.
- Send each worker the packaged prompt plus a narrow runtime envelope. Do not alter the packaged
  prompt body.

## Completion

Use the surface's native completion signal for subagents. Use wake files and filesystem watches only
for explicitly requested visible-thread workers with no native completion signal. Treat every wake as
a notification only; confirm real state from worker output, git diff, gates, or live PR/check state.

Do not run tight polling loops.

## Review Loop

- After an implementer reports completion, the coordinator inspects the diff for pathset, dependency,
  and obvious gate readiness before review. The coordinator does not perform the reviewer's
  code-quality or AC-satisfaction role.
- Start one independent reviewer for that story, created once for the story.
- If the reviewer returns findings, re-address the same implementer with the exact findings.
- Send the fix back to the same reviewer for rereview.
- Repeat until explicit `APPROVED`, a real blocker, or the review cap is reached.

## Source-Contract Blockers

If an implementer or reviewer reports that a packaged story cannot be implemented or reviewed because
the frozen contract is missing a required source fact, contradicts itself, or names a STOP condition
that overlaps an AC or failure trigger, treat it as a planning blocker rather than a worker defect.

Required coordinator behavior:

- inspect the report against the packaged story contract and prompt;
- do not ask the worker to invent the missing source fact or continue with a guessed interpretation;
- leave the story uncommitted and do not start or unlock dependents;
- update the tracker blocker/notes fields with the affected AC or failure row, missing fact, worker
  alias, and route-back target (`$plan-epic` for frozen story defects, `$plan-delivery` for package-only
  projection defects);
- make a tracker-only evidence commit when the repo workflow allows tracker commits for blocked
  stories, otherwise report the uncommitted tracker blocker explicitly.

Default review cap is five rounds unless the package, repo instruction, or user sets a stricter cap.
If the cap is reached without approval, stop that story, leave it uncommitted, and report the open
findings.

## Coordinator-Only Mutations

Workers must not stage, commit, push, create or update PRs, merge, archive, close, or mark stories
complete. The coordinator performs those actions after independent inspection and required gates.
Workers hold NO Forge credentials (per AGENTS.md AD-12 worker/runner isolation); only the
coordinator/runner holds push/PR/merge authority.

Reviewer approval is advisory. The coordinator still verifies scope control, changed files, checks,
and dependency boundaries before a commit, without re-characterizing or expanding the work.

## Closing Workers

Keep a story's implementer and reviewer open through every fix/rereview round and through the
coordinator commit sequence. Close or archive only that story's pair after its story commit and
tracker evidence commit are complete. Leave unrelated worker pairs untouched.

If the surface cannot close or archive contexts, mark only that story's pair terminal in the ledger.
