---
title: kit-vnext - work item authoring guide
status: draft
last-reviewed: "2026-06-20"
---

# Work item authoring guide

This guide defines how to write implementation story contracts. A good story contract lets a builder,
maintainer, or verifier reach the same DONE verdict from the same written evidence.

It defines WHAT each story must deliver. It does not define operational prompts, review-loop
mechanics, PR mechanics, commit policy, or session orchestration.

## Why this standard exists

The initial Frontier 0/1 implementation charters created avoidable ambiguity. Their charters were coherent
enough for design review, but not precise enough for implementation review: DONE conditions were
sometimes prose, failure behavior was sometimes adjectival, and some branches left design choices to
the implementer.

Frontier 2 worked because the item contracts gave one shared rubric:

- a spec-surface manifest;
- enumerated acceptance criteria;
- failure and degraded outcome rows;
- required evidence and test catalogues;
- explicit boundaries and STOP conditions.

That is the standard here. The frontier charter frames the frontier; the story contract is the dispatch
surface.

## One principle

Write for the implementation gate, not the design gate.

Design prose can be coherent without being directly testable. Implementation stories must be
countable and falsifiable. A story like "resolution precedence exactly as specified" is not ready,
because every reader has to privately re-derive what "exactly" means. A ready story names the exact
spec surface, the acceptance criteria, the failure outcomes, and the evidence that proves them.

Three consequences follow:

1. Evidence over prose applies to story contracts too. A story states checkable conditions and the
   evidence that proves them, not intentions.
2. One shared rubric. Builders, maintainers, and verifiers grade against the same enumerated AC list
   and failure table. A bar that lives only in someone's head guarantees divergence.
3. High altitude on HOW, precise on DONE. The story should not dictate internal file layout,
   signatures, or algorithms unless the design makes them normative. It must pin acceptance criteria,
   failure outcomes, evidence, and public contract shapes.

Altitude governs HOW. Acceptance criteria govern DONE. These do not conflict: keep HOW free, keep
DONE pinned. Where the design names a type, event, field, token, or semantic, that is not internal
implementation detail; it is spec surface.

## The five hard rules

Each rule fixes a failure mode from the early frontier work. A story that violates any of them is not
ready to use.

### R1 - Enumerate acceptance criteria and list the spec surface

Every story carries:

- an ordered list of `AC-n` entries, each a single falsifiable assertion;
- a spec-surface manifest naming the interfaces, events, DTOs, commands, evidence records, and
  failure modes the normative design defines.

Done means every AC is met and every manifest item is present with the design's names, shapes, and
semantics.

Good ACs are testable:

- Good: `AC-4` a staged deletion makes `clean()` return `false`.
- Weak: handles git status correctly.

The manifest turns "every interface/event/failure-mode implemented" into something countable. Without
it, readers independently re-derive the spec and find different gaps.

### R2 - Name every failure and degraded outcome

Failure behavior is contract surface. For each way the story can fail or degrade, write a row:

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `<kebab-token>` | Condition that activates the failure. | Required response. | `AC-n` |

Bare prose like "fail closed", "degrade safely", or "handle errors" is not enough. The trigger,
required behavior, and proving AC must be explicit.

This rule matters because many review blockers happen in degraded paths: audit bypass when no writer
is configured, authoritative writes during filesystem degradation, lease renewal after TTL expiry,
or missing redaction hooks. Those are not edge cases; they are the contract.

### R3 - Quantify and enforce the quality bar

Every story states:

- required test lanes from [`../engineering/testing-policy.md`](../engineering/testing-policy.md);
- exact commands required for completion evidence;
- coverage scope and threshold, normally at least 90% for the meaningful implementation area;
- required tests as a catalogue, not examples;
- file-size and determinism constraints, including injected clock/id/randomness where relevant;
- dependency boundaries from
  [`../design/20-sdk-and-packaging/dependency-rules.md`](../design/20-sdk-and-packaging/dependency-rules.md);
- domain-specific non-negotiables, such as redaction proven or no secret value in source/test output.

Coverage is not proof by itself. The required-test catalogue must enumerate the hard cases that prove
the ACs and failure rows. "Property and integration tests, for example..." leaves the hard choices to
implementation and usually reappears as review churn.

### R4 - The story is a subset of design

The normative design source wins. A story may make design requirements countable, but it must not add
requirements absent from design.

Before a story is ready, each AC must trace to the design. An AC with no design basis is a defect in
the story or a gap in the design:

- if the design should require it, amend design first;
- if the design does not require it, drop the AC.

This avoids false findings where implementation is graded against a stronger bar than the approved
spec. The story does not outrun the design.

### R5 - No unresolved option branches

A story must not hand unresolved design choices to implementation. Avoid "do A or B" branches. Pick
the design-backed outcome, name the exact output, and include sweep commands when the change crosses
docs or packages.

Bad:

- normalize tokens to kebab-case or ratify an exception;
- add the fields to producer X or revise consumer Y.

Good:

- producer X defines `PolicyLayer.credentialRef: { id: string; source: "env" | "file" }`;
- consumer Y cites that shape verbatim;
- `rg 'old_token' docs packages` returns zero hits, with output captured in the evidence pack.

Producer/consumer contracts name the shared shape once. Consumers cite that shape verbatim, never
"the fields X supplies."

## Story contract template

Copy this block for each implementation story. The story owns DONE, not HOW.

```markdown
---
title: "<id> - <name> implementation story"
id: "<id>"
frontier: <n>
status: "story: draft"
design:
  - "<path to normative design README>"
---

# <id> - <name>

## Purpose

<One sentence describing the story's single job, tied to requirement and decision ids where relevant.>

## Normative design

- <design README path>
- <required sibling aspect files>
- <accepted decisions or engineering policies that constrain this story>

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types:
- Events / append intents:
- Provider operations / commands:
- Failure and degraded tokens:
- Evidence records / attestations:

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- <Positive obligations owned by this story.>

## Out of scope

- <Nearby concerns owned by another story/domain, named by id.>

## Dependencies and frozen inputs

- Depends on:
- Depended on by:
- Cross-story shapes:

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** <Falsifiable assertion> - evidence: <test or artifact>.
- **AC-2** <Falsifiable assertion> - evidence: <test or artifact>.

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `<kebab-token>` | <condition> | <required behavior> | AC-<n> |

## Quality bar

- Coverage scope and threshold:
- Required tests, catalogued by AC and failure row:
- Determinism constraints:
- Dependency boundaries:
- File-size or module-size constraints:
- Domain non-negotiables:

## Required reading

- <This story's spec README and aspect files>
- <named policy docs>
- <named decisions>
- <named sibling contracts>

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The <package/module> providing <the surface from the manifest>, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results for any cross-corpus or cross-package change.
- Conformance, smoke, or runtime-attestation evidence when a provider/capability is involved.
- Provider `evidence/` appendix when the story depends on provider schema or live behavior.

## Boundaries and STOP conditions

- Package or module boundary:
- Forbidden dependencies:
- STOP when:
```

## Frontier charter template

Copy this block for each frontier. Keep it to the frontier frame; per-story detail belongs in
story contracts.

```markdown
---
title: "Frontier <n> - <frontier name>"
frontier: <n>
status: "frontier: draft"
depends-on-frontiers: [<...>]
---

# Frontier <n> - <frontier name>

## Purpose

<What this frontier makes possible.>

## Included domains

| Domain | Role in this frontier | Primary spec surface |
|---|---|---|

## Why this frontier exists

<Why these domains become eligible together and what later frontier they unblock.>

## Frozen inputs

- <Prior frontier outputs and design sources consumed by this frontier.>

## Outputs

- <Contract surfaces, packages, modules, tests, or evidence this frontier must leave behind.>

## Scope boundaries

- In:
- Out:
- STOP when:

## Per-domain expectations

### `<domain-id>` - <name>

- Responsibility:
- Expected story files:
- Evidence expectation:

## Frontier readiness

- <Conditions that make the next frontier safe to author or dispatch.>

## Deferred work

- <Work intentionally left to later frontiers, named by owning domain or frontier.>
```

## Contract readiness gates

These are authoring gates for the contract documents. They are not an execution process.

### Gate A - Story is authoring-ready

For every story:

- [ ] AC list exists; every AC is falsifiable and traces to the design.
- [ ] Spec-surface manifest exists and matches the design.
- [ ] Failure/degraded outcome table exists; every named state has a proving AC.
- [ ] Coverage number and enforcement command are stated.
- [ ] Required tests are catalogued, not presented as examples.
- [ ] Zero unresolved option branches remain.
- [ ] Cross-story contracts name exact shapes.
- [ ] Sweep commands are listed for cross-corpus or cross-package changes.
- [ ] Boundaries include owned package/module, dependency-rule edge, and STOP conditions.

If any box is empty, the story is not ready.

### Gate B - Evidence pack is complete

An implementation claim can be evaluated only when the evidence pack contains:

- a test or artifact for every AC;
- a test or artifact for every failure/degraded outcome row;
- gate output or a named unrelated gate blocker;
- coverage command and result for the stated scope;
- sweep-grep output for cross-corpus or cross-package changes;
- conformance, smoke, or attestation evidence for providers and capabilities.

No manifest item may be missing. No requirement may be invented beyond design. Any spec ambiguity
must be surfaced as a design gap, not guessed in implementation.

### Gate C - Readiness matrix can be updated

The readiness matrix may move an implementation axis to `yes` only with cited executable evidence.
Design approval, prose, migrated code, fixtures, schema snapshots, or worker self-report may justify
`partial`; they do not prove implementation readiness.

## Worked fragment: prose vs enumerated

From the Frontier 1 redaction lesson.

Wrong:

> Redaction proven by property tests: no secret survives a log, telemetry, or artifact path.

That leaves the hard cases implicit. A weak property can pass while secrets leak as object keys,
base64 strings, JSON-escaped text, command lines, stack traces, or provider payloads.

Right:

> **AC-7** No secret value appears in any log, telemetry, provider response, command capture, prompt,
> tool result, error, stack, or artifact output, across every supported encoding and position.

Required tests:

- secret as an object value;
- secret as an object key;
- secret base64-encoded;
- secret JSON-escaped;
- secret embedded in an error message or stack;
- secret embedded in command output;
- secret embedded in provider response text.

Failure row:

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `redaction-unavailable` | A path that requires redaction has no redaction hook. | Refuse the write; never emit unredacted material. | AC-8 |

Now the story names the cases that matter. There is no private re-derivation left for a later reader.

## Quick reference

A story is ready when it has:

- falsifiable `AC-n` list;
- spec-surface manifest;
- failure/degraded outcome table;
- coverage number and enforcement command;
- required-test catalogue;
- zero unresolved option branches;
- exact cross-story shapes;
- sweep commands where needed;
- evidence pack expectations;
- owned boundary and STOP conditions.

The five rules in one line: R1 enumerate ACs and manifest; R2 name failure outcomes; R3 quantify and
enforce quality; R4 story is a subset of design; R5 no unresolved branches.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](./README.md) · **← Prev:** [package rollout](./package-rollout.md) · **Next →:** [implementation readiness matrix](./readiness-matrix.md)

<!-- /DOCS-NAV -->
