---
title: kit-vnext - work item authoring guide
status: draft
last-reviewed: "2026-06-22"
---

# Work item authoring guide

This guide defines how to author the three implementation-planning layers for kit-vnext, top-down:
**domain charters -> epic charters -> story contracts**. Each layer has its own job, its own altitude,
and its own readiness bar. The shared goal is that a builder, maintainer, or verifier reaches the same
verdict from the same written artifact, with no private re-derivation.

It defines WHAT each layer must deliver. It does not define operational prompts, review-loop mechanics,
PR mechanics, commit policy, or session orchestration.

## Why this standard exists

The initial Epic 0/1 implementation charters created avoidable ambiguity. They were coherent enough for
design review, but not precise enough for implementation review: DONE conditions were sometimes prose,
failure behavior was sometimes adjectival, and some branches left design choices to the implementer.

Epic 2 worked because the item contracts gave one shared rubric:

- a spec-surface manifest;
- enumerated acceptance criteria;
- failure and degraded outcome rows;
- required evidence and test catalogues;
- explicit boundaries and STOP conditions.

That is the standard at the story layer. But the lesson generalizes: ambiguity is cheapest to remove at
the layer where it is introduced. A fuzzy domain boundary seeds a dozen fuzzy stories. So each layer
gets a bar matched to what it actually owns, not a copy of the story bar.

## The three authoring layers

Implementation planning descends through three layers. The **domain layer is authored first**. It is
**not an implementation spec** - it is the generative source the epics and stories are derived from
later. Epics group domains into milestones; stories under an epic are the dispatch surface.

| Layer | Artifact | Authored | Job | Altitude | Graded on |
|---|---|---|---|---|---|
| Domain | `domains/<layer>/<id>.md` | first | name what a domain owns, what it does not own, and the signals that seed its stories | WHAT only; no HOW, no AC | crisp boundary; signals trace to design |
| Epic | `epics/epic-<n>/README.md` | second | frame one reviewable milestone over a set of domains | milestone outcomes; no story detail | concrete outputs; explicit readiness; domain coverage |
| Story | `epics/epic-<n>/stories/<id>.md` | last | the dispatch surface a builder implements and a verifier grades | precise DONE; free HOW | the five hard rules |

Two rules hold across all three layers.

- **Subset of the source.** Each layer is a checkable subset of the one above it, and ultimately of
  [`../design/`](../design/). A domain charter adds nothing beyond its design README; an epic charter
  adds nothing beyond its domain charters; a story adds nothing beyond design. A new requirement means
  amending the source first, never inventing it at a lower layer.
- **Altitude flows down, never up.** A domain charter must not carry acceptance criteria; an epic
  charter must not carry story-level DTO, event, or test detail; a story must not re-decide a domain
  boundary. Lower-layer detail placed in a higher layer rots, because the lower layer is where it is
  actually maintained.

The DAGs own dependency edges: [`domain-dag.md`](domain-dag.md) for domain edges,
[`epic-dag.md`](epic-dag.md) for epic edges. Every layer names its edges for readability but defers to
the DAGs; when they disagree, the DAG wins.

## One principle: evidence over prose, sharpened per layer

Write for the next reader's verdict, not for narrative coherence. Design prose can be coherent without
being checkable. The same instinct applies at every layer, and it sharpens as you descend:

1. **Evidence over prose.** A domain signal names a real design surface; an epic output names a concrete
   contract, package, or evidence artifact; a story AC is a single assertion that is true or false
   against a test or artifact. "Handles it correctly" is never ready at any layer.
2. **One shared rubric.** Authors and reviewers grade against the same written check for that layer, not
   a bar that lives in someone's head.
3. **Altitude on HOW, precise on the layer's contract.** Where the design names a type, event, field,
   token, or semantic, that is spec surface, not internal detail - and it is named, not paraphrased,
   at whatever layer first references it.

The rest of this guide gives each layer its purpose, its shape or template, its readiness check, and
the lesson it encodes.

---

## Layer 1 - Domain charter

### Purpose

A domain charter is a compact planning card, authored first, derived from exactly one design-domain
README (`source-design`). It is **not for implementation** and carries **no acceptance criteria**. Its
job is to fix what a domain owns, what it explicitly does not own, and the story-group signals that
later seed its epics and stories. A wrong boundary or an untraceable signal here propagates into every
story under the domain, so this is where that class of defect is cheapest to stop.

### Shape

Frontmatter carries `id`, `layer`, `status`, `source-design`, and `last-reviewed`. The body uses this
shape, in order:

- `What` - the implementation-planning responsibility in plain language, naming owned spec surface with
  the design's own type/event/token names where it helps a later story author.
- `Why` - why the domain matters to the rebuild sequence and what it unblocks.
- `Does Not Own` - nearby concerns that belong elsewhere, each attributed to the owning domain, epic, or
  story group by id.
- `Inputs And Dependencies` - the `source-design` README, direct domain dependencies (or `none`), and
  the planning artifacts that order the work. Layer-specific lines are expected: provider charters split
  SDK vs testkit inputs; core charters name their implementation DAG band.
- `Downstream Epics` - milestone epics that consume this domain.
- `Story Group Signals` - likely story groups this domain will shape, without acceptance criteria or
  implementation HOW.

The catalog of authored charters lives in [`domains/README.md`](domains/README.md).

### Readiness check (Gate 1)

A domain charter is planning-ready only when all four hold:

- [ ] **Boundary is crisp.** `Does Not Own` names each excluded concern and attributes it to a specific
  owner id, with no overlap against sibling charters in the same layer.
- [ ] **Signals trace to design.** Every `Story Group Signal` and every named type/event/token maps to
  the `source-design` README or a cited sibling design file. Nothing is invented beyond design.
- [ ] **Altitude holds.** The charter states WHAT the domain owns, not HOW. No acceptance criteria,
  algorithms, file layout, or session mechanics.
- [ ] **Edges defer to the DAGs.** `Inputs And Dependencies` and `Downstream Epics` are consistent with
  the domain and epic DAGs and do not restate edge rationale the DAGs own.

If any box is empty, the charter is not ready and its stories must not be authored.

### Lesson encoded

The early epic charters were coherent for design review but seeded ambiguous stories. The fix at the
domain layer is not acceptance criteria - it is boundary crispness and signal traceability, because
those two properties are exactly what the stories under the domain inherit.

---

## Layer 2 - Epic charter

### Purpose

An epic charter frames one reviewable milestone over a set of domains. It states what becomes possible
when those domains land together and what later epic it unblocks. It holds no story-level detail: it
bounds the stories, it does not pre-write them.

### Template

Copy this block for each epic. Keep it to the epic frame; per-story detail belongs in story contracts.

```markdown
---
title: "Epic <n> - <epic name>"
epic: <n>
status: "epic: draft"
depends-on-epics: [<...>]
---

# Epic <n> - <epic name>

## Purpose

<What this epic makes possible.>

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|

## Why this epic exists

<Why these domains become eligible together and what later epic they unblock.>

## Frozen inputs

- <Prior epic outputs and design sources consumed by this epic.>

## Outputs

- <Contract surfaces, packages, modules, tests, or evidence this epic must leave behind.>

## Scope boundaries

- In:
- Out:
- STOP when:

## Per-domain expectations

### `<domain-id>` - <name>

- Responsibility:
- Expected story files:
- Evidence expectation:

## Epic readiness

- <Conditions that make the next epic safe to author or dispatch.>

## Deferred work

- <Work intentionally left to later epics, named by owning domain or epic.>
```

### Readiness check (Gate 2)

An epic charter is planning-ready only when all five hold:

- [ ] **Domains map down.** Every included domain has an authored domain charter, and its role here is
  consistent with that charter's `What` and `Downstream Epics`.
- [ ] **Outputs are concrete.** Each output names a contract surface, package, module, test lane, or
  evidence artifact - not an adjective like "robust" or "complete".
- [ ] **Readiness names the unblock.** `Epic readiness` states the conditions that make the next epic
  safe to author or dispatch, in terms a later author can check.
- [ ] **Edges match the DAG.** `depends-on-epics` and dependency prose agree with
  [`epic-dag.md`](epic-dag.md); no edge rationale the DAG owns is re-argued.
- [ ] **No story detail leaks up.** No acceptance criteria, DTO field lists, event payloads, test
  catalogues, or file layouts appear; those are story surface.

If any box is empty, the epic is not ready and its story DAG must not be frozen.

### Lesson encoded

Epic 2 worked because its frame was clear and the rubric lived in its stories. The epic charter's job is
to make the milestone reviewable and bound the stories - not to inflate into a spec, and not to deflate
into adjectives.

---

## Layer 3 - Story contract

The story is the dispatch surface. It owns DONE, not HOW. A builder implements it and a verifier grades
it from the same written contract. Every story must satisfy the five hard rules below; each fixes a
failure mode from the early epic work.

### R1 - Enumerate acceptance criteria and list the spec surface

Every story carries:

- an ordered list of `AC-n` entries, each a single falsifiable assertion;
- a spec-surface manifest naming the interfaces, events, DTOs, commands, evidence records, and failure
  modes the normative design defines.

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

Bare prose like "fail closed", "degrade safely", or "handle errors" is not enough. The trigger, required
behavior, and proving AC must be explicit.

This rule matters because many review blockers happen in degraded paths: audit bypass when no writer is
configured, authoritative writes during filesystem degradation, lease renewal after TTL expiry, or
missing redaction hooks. Those are not edge cases; they are the contract.

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

Before a story is ready, each AC must trace to the design. An AC with no design basis is a defect in the
story or a gap in the design:

- if the design should require it, amend design first;
- if the design does not require it, drop the AC.

This avoids false findings where implementation is graded against a stronger bar than the approved spec.
The story does not outrun the design.

### R5 - No unresolved option branches

A story must not hand unresolved design choices to implementation. Avoid "do A or B" branches. Pick the
design-backed outcome, name the exact output, and include sweep commands when the change crosses docs or
packages.

Bad:

- normalize tokens to kebab-case or ratify an exception;
- add the fields to producer X or revise consumer Y.

Good:

- producer X defines `PolicyLayer.credentialRef: { id: string; source: "env" | "file" }`;
- consumer Y cites that shape verbatim;
- `rg 'old_token' docs packages` returns zero hits, with output captured in the evidence pack.

Producer/consumer contracts name the shared shape once. Consumers cite that shape verbatim, never "the
fields X supplies."

### Story contract template

Copy this block for each implementation story. The story owns DONE, not HOW.

```markdown
---
title: "<id> - <name> implementation story"
id: "<id>"
epic: <n>
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
- Conformance evidence for every provider port/mocking surface involved; runtime / production
  attestation evidence only when the story claims a real driver capability or live production power.
  Core stories may use recorded/mock attestations to prove gate predicates, but must not require real
  processes or network.
- Provider `evidence/` appendix when the story depends on provider schema or live behavior.

## Boundaries and STOP conditions

- Package or module boundary:
- Forbidden dependencies:
- STOP when:
```

### Worked fragment: prose vs enumerated

From the Epic 1 redaction lesson.

Wrong:

> Redaction proven by property tests: no secret survives a log, telemetry, or artifact path.

That leaves the hard cases implicit. A weak property can pass while secrets leak as object keys, base64
strings, JSON-escaped text, command lines, stack traces, or provider payloads.

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

---

## Readiness gates

Authoring gates for the contract documents, one per layer plus the two evidence gates. They are
authoring gates, not an execution process. Gate 1 is defined in [Layer 1](#readiness-check-gate-1) and
Gate 2 in [Layer 2](#readiness-check-gate-2); the story gates follow.

### Gate 3 - Story is authoring-ready

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

### Gate 4 - Evidence pack is complete

An implementation claim can be evaluated only when the evidence pack contains:

- a test or artifact for every AC;
- a test or artifact for every failure/degraded outcome row;
- gate output or a named unrelated gate blocker;
- coverage command and result for the stated scope;
- sweep-grep output for cross-corpus or cross-package changes;
- conformance evidence for provider ports and mocks, plus runtime / production attestation evidence only
  for real driver capabilities or live production powers.

Mock-driven core evidence proves SDK/core readiness; real runtime probes prove production readiness for
concrete drivers.

No manifest item may be missing. No requirement may be invented beyond design. Any spec ambiguity must
be surfaced as a design gap, not guessed in implementation.

### Gate 5 - Readiness matrix can be updated

The readiness matrix may move an implementation axis to `yes` only with cited executable evidence.
Design approval, prose, migrated code, fixtures, schema snapshots, or worker self-report may justify
`partial`; they do not prove implementation readiness.

## Quick reference

A **domain charter** is ready when: `Does Not Own` attributes every excluded concern to an owner id;
every signal traces to `source-design`; it carries no AC or HOW; edges match the DAGs.

An **epic charter** is ready when: every included domain maps to a charter; outputs are concrete
surfaces, not adjectives; `Epic readiness` names the next-epic unblock; edges match the epic DAG; no
story-level detail leaks up.

A **story contract** is ready when it has: a falsifiable `AC-n` list; a spec-surface manifest; a
failure/degraded outcome table; a coverage number and enforcement command; a required-test catalogue;
zero unresolved option branches; exact cross-story shapes; sweep commands where needed; evidence-pack
expectations; and an owned boundary with STOP conditions.

The five story rules in one line: R1 enumerate ACs and manifest; R2 name failure outcomes; R3 quantify
and enforce quality; R4 story is a subset of design; R5 no unresolved branches.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](./README.md) · **← Prev:** [implementation contract](./README.md) · **Next →:** [domain dependency DAG](./domain-dag.md)

<!-- /DOCS-NAV -->
