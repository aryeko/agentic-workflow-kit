---
title: Completion and merge recommendations
status: post-research recommendation draft
last-reviewed: 2026-06-18
sources: [R8, R9]
---

# Completion and merge

## Problem

The old gate treated child-updated tracker status as the completion authority. That is better than child
prose, but still lets the child choose the authoritative label. Merge policy was also implicit: in one
incident, a blocker-evidence PR was merged manually while the story remained blocked.

## Recommendation

Completion and merge must be runner-owned decisions based on independently gathered evidence tied to exact
commits.

The child may propose a status, PR, blocker, or verification result. Those claims are hints. The runner
decides.

Sources: [R8](../research-reports/R8-verification-completion-authority.md),
[R9](../research-reports/R9-pr-review-ci-merge-gating.md).

## Completion evidence

Before marking a story complete, gather:

- `GitEvidence`: branch, base/head SHAs, commit count, uncommitted paths, diff from merge base, changed-file
  policy classification;
- `VerificationEvidence`: configured command, argv, cwd, start/end, exit code, signal, output refs,
  output digests, runner identity, head SHA before/after;
- `CIEvidence`: PR number, exact head SHA, workflow/check ids, required context list, conclusions,
  trusted source identity;
- `PREvidence`: PR state, head branch/SHA, base branch/SHA, mergeability, branch existence;
- `ReviewEvidence`: required review decision, unresolved threads, bot findings, re-review state;
- `BlockerEvidence`: typed blocker, source, reproduction/evidence refs;
- `ClaimReconciliation`: child claim compared to runner evidence.

If child says done and evidence is absent or contradictory, emit `claim-evidence-mismatch`.

## Verification capture

Verification output must be runner-owned:

- command spec comes from config/policy, not child prose;
- run via an owned process wrapper or trusted CI evidence;
- capture stdout/stderr as immutable artifacts with digests;
- record exit code, signal, timeout, timestamps, command hash, cwd, env allowlist hash, and exact head SHA;
- if UI output is truncated, preserve full output digest/ref.

Driver-observed tool output can count only if it includes actual command, output, and exit status. Natural
language summaries do not count.

## Changed-file policy

Always classify changes from merge base. Escalate or block changes that can weaken verification or policy:

- package scripts;
- verification commands;
- CI workflows;
- lockfiles;
- workflow config;
- generated evidence artifacts;
- tracker files.

This prevents a child from making tests green by weakening the gate.

## Merge evidence

The merge inspector should produce:

- PR identity and tracker link match;
- branch protection/ruleset requirements;
- required checks and trusted sources;
- review decision, requested reviewers, code-owner/stale-review settings;
- unresolved review threads;
- configured bot finding state;
- base/head freshness;
- merge queue requirement and queue entry state;
- allowed merge method;
- exact API action and expected head SHA.

## Fail-closed merge predicate

Autonomous merge is allowed only when all are true:

- config and capability gates allow auto-merge;
- control plane satisfies irreversible-action prerequisites;
- PR is open, not draft, and matches expected story branch/base;
- branch protection/ruleset inspection succeeds, or repo explicitly allows unprotected merges;
- no admin/bypass path is used;
- exact head SHA has not changed since evidence collection;
- required verification or trusted CI passed for the exact head/test merge commit;
- required checks pass with configured source trust;
- review decision satisfies policy;
- no latest blocking `CHANGES_REQUESTED`;
- review threads required by policy are resolved;
- configured bot findings are resolved or represented by trusted green checks;
- base freshness is satisfied by strict checks, update/rebase plus rerun, or merge queue validation;
- merge method is allowed.

If base/head changes after inspection, discard evidence and rerun inspectors.

## Merge queue

If the base branch requires a merge queue, do not direct-merge. Enqueue and watch queue state until merged
or parked. If queue APIs are unavailable, stop as `merge-queue-required-unavailable`.

## Blocker-evidence PRs

Represent this explicitly:

- `merge_kind: completion` means merged PR completes the story;
- `merge_kind: blocker_evidence` means the PR records evidence or partial safe cleanup while the story
  remains blocked.

`blocker_evidence` merge requires `mergeBlockerEvidence.enabled` and normal merge safety, except completion
verification is replaced by typed blocker evidence. Merging it must not mark the story complete.

## Degraded modes

| Missing evidence | Behavior |
|---|---|
| local verify unavailable | accept exact-head trusted CI only, else block |
| GitHub auth unavailable | no GitHub auto-merge |
| branch protection/rulesets unknown | block unless unprotected auto-merge explicitly allowed |
| review-thread API unavailable | block if thread resolution is policy-required |
| bot finding state unknown | block if bot is part of merge policy |
| stale base/head changed | rerun inspectors |
| merge endpoint conflict/error | refresh evidence once, then park |

## Validation spikes

- Completion decision fixture matrix.
- Runner-owned verify wrapper with forged child summary.
- Review-thread GraphQL query against real PR.
- Exact-head merge rejection after new push.
- Merge queue pass/fail flow.
- Bot finding adapter fixture.
- Changed verification script escalation.
