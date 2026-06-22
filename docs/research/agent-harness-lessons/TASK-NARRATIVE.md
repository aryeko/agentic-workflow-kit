# Agent harness lessons task narrative

## Task

The task was to turn a set of external agent-engineering sources into a durable,
source-backed research package for kit-vnext:

- OpenAI Harness engineering.
- OpenAI Codex ExecPlans.
- Matklad's `ARCHITECTURE.md` article.
- OpenAI Responses API year-one product examples.
- `openai/symphony`, especially its `SPEC.md`.

The requested answers were practical:

- What guidelines, best practices, and lessons the sources imply.
- Where kit-vnext stands against those lessons.
- What kit-vnext should learn.
- What kit-vnext already does better and should keep.
- How kit-vnext should improve, and why.

## Why this was done

kit-vnext is itself an agent control harness. The external sources are valuable only if
they are compared against kit-vnext's actual design and implementation state, not treated
as generic inspiration. The research therefore keeps two separate evidence tracks:

- Source notes derive guidance from the articles and Symphony repository.
- Repo audits test those guidelines against live `v-next` docs, code, tests, tooling,
  and package state.

This prevents the report from drifting into a product tour and keeps recommendations
usable as future docs or story work.

## How the work was done

The work ran in the isolated worktree:

```txt
/Users/aryekogan/repos/workflow-kit/.worktrees/harness-research
```

The branch is:

```txt
codex/harness-research
```

The implementation sequence was:

1. Verify the root checkout and worktree inventory.
2. Create the research worktree from `origin/v-next`.
3. Seed a restartable research structure under `docs/research/agent-harness-lessons/`.
4. Use parallel source-note agents for the five external sources.
5. Audit the current repository while source notes were being written.
6. Synthesize the source-derived guideline matrix.
7. Use parallel repo-audit agents for docs legibility, architecture enforcement,
   orchestration/autonomy, and observability/improvement loops.
8. Write the top-level current-state audit and roadmap.
9. Run local verification and record the result in the runbook.

## What changed

The research package now contains:

- `README.md` - short TLDR and report map.
- `SOURCES.md` - source list, access date, and pinned Symphony commit.
- `RESEARCH-RUNBOOK.md` - restartable progress, decisions, and verification record.
- `GUIDELINE-MATRIX.md` - source-derived guidelines mapped to kit-vnext status.
- `CURRENT-STATE-AUDIT.md` - evidence-backed standing by guideline group.
- `LESSONS-AND-ROADMAP.md` - keep/change recommendations and rationale.
- `source-notes/` - one note per external source.
- `repo-audit/` - current repo evidence and audit slices.

## Main findings

kit-vnext is already stronger than the public source patterns on the core safety
properties of an agent control plane:

- Append-only event-log authority.
- Worker/runner action separation.
- Capability attestation and fail-closed defaults.
- Evidence gates over worker self-report.
- Separation between Work Source task status and run activity.

The current implementation is strongest in foundation substrate and verification:
configuration/policy, storage, artifacts, leases, workspace/repository, credentials,
and the local check gate have real code and tests. The remaining large gaps are the
provider ports and concrete drivers, core orchestration runtime, analysis/evals, and
agent-legible physical repo navigation as the package tree grows.

## Verification

Verification was run from the harness research worktree:

```txt
pnpm docs:nav
pnpm docs:nav:check
pnpm format:check
pnpm check
git diff --check
```

Additional local checks confirmed there was no trailing whitespace in the research tree
and that all local Markdown links inside the research package resolve. The research tree
also passed the requested banned-token sweep.
