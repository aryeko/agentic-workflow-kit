---
title: "Story contract template"
status: draft
last-reviewed: "2026-06-22"
---

# Story contract template

Copy the block below for each implementation story. The story owns DONE, not HOW.

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

For runtime stories, use:

- Interfaces / types:
- Events / append intents:
- Provider operations / commands:
- Failure and degraded tokens:
- Evidence records / attestations:

For substrate/config stories, use:

- Validated artifacts:
- Validation failure modes:
- Evidence records / attestations:

Pick the variant that matches the story's deliverable. Do not invent unused runtime types or tokens to
satisfy the template.

Done requires every item here present with the design's names, shapes, and semantics. For
substrate/config stories, every validated artifact must have an artifact-shape assertion and every
validation failure mode must have a negative fixture or equivalent failing assertion.

## Responsibilities

- <Positive obligations owned by this story.>

## Out of scope

- <Nearby concerns owned by another story/domain, named by id.>

## Dependencies and frozen inputs

- Covers signals: <the story-DAG node's claimed signal(s)>.
- Depends on: <producer stories, by id>.
- Depended on by: <consumer stories, by id>.
- Shared shapes consumed: <`<producer-story>/<type>`, cited verbatim, not redeclared>.
- Decision inputs consumed: <request fields, consumed events/projections, producer-owned fields, or
  resolvers that supply every runtime branch value used by the ACs and failure rows>.

Name exact producer/consumer shapes and fields. Do not write "the fields supplied by X." A ref, hash,
citation, or story id is provenance only; it is not the value being evaluated unless this story owns or
consumes the resolver that turns it into values.

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified." A happy-path command proves only successful acceptance; every rejection or negative-outcome
AC names the failing fixture or artifact that proves it. The `evidence` names the exact test id or command
and the result it produces, so a reviewer can re-run it — a prose category like "schema tests" is not
evidence. If an AC branches on policy, scope, approval, capability state, authority, or another runtime
condition, it must name the declared input, consumed event/projection, producer-owned field, or resolver
that supplies that value.

- **AC-1** <Falsifiable assertion> - evidence: <exact test id or command, and the result it produces>.
- **AC-2** <Falsifiable assertion> - evidence: <exact test id or command, and the result it produces>.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| <responsibility or manifest item> | AC-<n> |

## Predicate-input matrix

Every behavioral AC and every failure/degraded trigger is decidable from declared inputs, consumed
events/projections, producer-owned fields, or an in-scope resolver. Do not count refs, hashes,
citations, or story ids as values unless the resolver is in scope.

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-<n> | <condition evaluated> | <request field, event field, projection field, producer field, or resolver output> | <producer story/type or resolver owned here> | decidable |

## Failure and degraded outcomes

For runtime stories, use the token table. Each row's `proven by` AC must assert this row's trigger and
required behavior — verify the cited AC against the row.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `<kebab-token>` | <condition> | <required behavior> | AC-<n> |

For substrate/config stories, use the validation-failure table instead. Each row's `proven by` AC must
assert the invalid fixture and required validation failure — verify the cited AC against the row.

| failure mode | invalid fixture | required validation | proven by |
|---|---|---|---|
| <plain-language failure mode> | <invalid artifact shape or command-chain fault> | <required validation failure> | AC-<n> |

## Quality bar

- Coverage scope and threshold:
- Coverage command and instrumented lane(s):
- Required tests, catalogued by AC and failure row:
- Public exposure (import path + public-import test), or "none — no public SDK surface":
- Determinism constraints:
- Dependency boundaries:
- File-size budget (lines per file; default soft cap ~200):
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
- Test name or artifact proving each failure/degraded outcome or validation-failure row.
- Negative fixture or equivalent failing assertion for every rejection, fail-fast, or validation failure
  claim.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane(s), and number for the stated scope.
- Public-import test result for every shape the story exposes on the public SDK surface (imported through
  the intended path, not a private module).
- Boundary/forbidden-symbol sweep: exact command, path roots, forbidden-token set, and zero-match output,
  for any cross-corpus or cross-package change.
- Predicate-input evidence for every behavior AC and failure row, proving each runtime branch value comes
  from a declared input, consumed event/projection, producer-owned field, or in-scope resolver.
- Conformance evidence for every provider port/mocking surface involved; runtime / production
  attestation evidence only when the story claims a real driver capability or live production power.
  Core stories may use recorded/mock attestations to prove gate predicates, but must not require real
  processes or network.
- Provider `evidence/` appendix when the story depends on provider schema or live behavior.

## Boundaries and STOP conditions

- Package or module boundary:
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
- Forbidden dependencies:
- STOP when:
```

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Authoring standard — Pillar 1](../README.md) · **← Prev:** [Epic charter template](./epic-charter.md) · **Next →:** [Story DAG template](./story-dag.md)

<!-- /DOCS-NAV -->
