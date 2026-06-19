---
title: Coordinated worker workflow report
status: local development workflow analysis
last-reviewed: 2026-06-19
---

# Coordinated Worker Workflow Report

This report captures the working method observed in the coordinated sessions
that motivated this local kit. It is intentionally about the development
workflow only. It is not v1 runtime architecture, not public plugin behavior,
and not a replacement for the kit-vnext control-plane design.

## Source Sessions

- `019edc1f-5965-71e3-b0f4-79670f14585c`
- `019edc8d-0a25-7803-b7c2-401dca862003`

Those sessions worked because a large, ambiguous goal was converted into
bounded delegation contracts. The important ingredient was not parallelism by
itself. It was parallelism over stable inputs: exact allowed reads, exact write
scope, explicit outputs, explicit dependency gates, and independent review.

## What Made It Possible

### Bounded Units

Each unit had a clear owner, identity, output path, and scope. That let a task
implementer act without inventing policy, let a reviewer inspect a narrow
surface, and let the coordinator stage and commit one approved unit at a time.

Good units answer these questions before implementation starts:

- what problem the unit owns
- what files it may read
- what files it must not read
- what files it may write
- what outputs prove the unit exists
- what dependencies must be complete first
- what should block approval

### Exact Input Contracts

The strongest prompts used "read only these files" as a contract boundary, not
as loose context. That avoided stale drafts, accidental dependency coupling,
and reviewer drift. It also made missing context visible: a worker could stop
instead of silently inventing a cross-unit contract.

### Role Separation

The workflow separated responsibilities:

- task implementer: writes or fixes one assigned unit
- task reviewer: independently reviews one assigned unit and does not edit
- coordinator: validates readiness, routes work, checks scope, verifies, stages,
  commits, and advances dependencies

This made review credible. It also made failures easier to diagnose because no
role owned every decision.

### Negative Approval Rules

The best review prompts did not ask for generic feedback. They included
specific criteria and "do not approve if" rules. Those rules made reviewers
conservative about the exact failure modes that would harm downstream work.

Examples of effective negative rules:

- do not approve if dependencies are read from drafts when committed outputs
  are required
- do not approve if evidence claims are not externally verifiable
- do not approve if ownership of a shared contract is ambiguous
- do not approve if a worker relies on files outside the allowed input list

### Same-Reviewer Incremental Loops

When a reviewer returned `CHANGES-NEEDED`, the fix went back to the same
implementer and the follow-up review went back to the same reviewer. Later
review rounds were limited to prior blockers plus regressions introduced by
the fix.

That reduced review drift, preserved issue context, and avoided reopening
resolved findings without cause.

### Stable Dependency Gates

Downstream work became reliable only after predecessor outputs were approved
and committed. The useful gate was:

1. Unit output exists.
2. Coordinator sanity-check passes.
3. Independent reviewer approves.
4. Coordinator verifies.
5. Coordinator stages and commits only that unit.
6. Downstream units may read the committed output.

This made approved units behave like frozen contracts.

### Evidence Over Prose

The coordinator did not trust worker self-report alone. It checked files,
diffs, review verdicts, verification commands, and git state. This matched the
kit-vnext principle that gates require external evidence, not prose.

## Exact Working Pattern

1. Plan the wave from source artifacts.
2. Split the work into units with exact contracts.
3. Rebuild the dependency plan from those contracts.
4. Start only units whose hard dependencies are satisfied.
5. Spawn one task implementer per ready unit.
6. Sanity-check each handoff before review.
7. Spawn one independent task reviewer per unit.
8. Route `CHANGES-NEEDED` findings back to the same implementer.
9. Reuse the same reviewer for incremental review.
10. Stop after the review cap.
11. Verify from the coordinator session.
12. Stage and commit only the approved unit scope.
13. Update durable wave status before continuing.

## What Worked Well

- Parallel work stayed manageable because write scopes were disjoint.
- Reviews were high signal because criteria and disapproval rules were
  concrete.
- Incremental rereview was cheaper and more stable than restarting review.
- Per-unit commits created a useful audit trail.
- Durable files made resume possible after context loss.

## What Did Not Work Well

- Real chat-thread orchestration added operational overhead: thread ids,
  duplicate creation risk, polling, archive bookkeeping, and sidebar clutter.
- Shared-checkout concurrency required strict staging checks.
- Early dependency planning was too conservative until dependencies were typed.
- Coordinator escape hatches needed explicit limits so the coordinator did not
  become a hidden implementer.
- Review prompts needed explicit guards against memory, web research, and
  unrelated drafts.

## Reusable Lessons

The input artifact is the important product. A strong wave plan makes the run
mostly mechanical: validate, spawn, review, fix, verify, commit, and stop on
ambiguity.

The reusable workflow should therefore remain split:

- `create-coordinated-wave` creates high-quality input contracts.
- `run-coordinated-wave` executes those contracts with minimal discretion.

The run skill should not compensate for weak input artifacts by guessing. If a
plan lacks exact reads, write scope, review criteria, dependency gates, or stop
conditions, the correct behavior is `NOT READY`.

## What Is Proven So Far

This PR proves the local scaffolding and Codex mechanics:

- repo-local `.codex` config can keep root agent depth at `1`
- the optional `wave-coordinator` can scope `max_depth = 2`
- root-to-coordinator-to-reviewer nested delegation can start successfully
- the local skills and wave docs are tracked as repo-local development
  infrastructure

It does not yet prove a full production run. A follow-up pilot should run one
small wave end to end, including implementation, independent review, fix and
rereview, coordinator verification, scoped staging, commit, and resume after
compaction if possible.
