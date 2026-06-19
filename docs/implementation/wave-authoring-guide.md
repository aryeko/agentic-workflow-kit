---
title: "Wave authoring guide"
status: active
last-reviewed: 2026-06-19
applies-to: "every implementation wave charter and work-item charter (W3+ and the driver track), and revisions to W0-W2"
---

# Wave authoring guide

How to write a wave so its PR passes an adversarial **code** review the first time. This is
the authoring standard for implementation **waves** and their **work-item charters**.

It sits beside its neighbours and does not repeat them:

- [`README.md`](./README.md) — *how work flows* (one PR per wave, one commit per item,
  implementer + independent reviewer, the DAG).
- [`package-map.md`](./package-map.md) — *where code goes* (package names, layers, SDK
  placement, the skeleton convention).
- [`readiness-matrix.md`](./readiness-matrix.md) — *what is proven* (the evidence axes).
- [`AGENTS.md`](../../AGENTS.md) — the invariants, branch model, the verify gate, conventions.
- [`docs/design/`](../design/) — the **normative** contracts a charter points at.

This guide is the missing piece: *how to write the contract that flows through that machine*
so an implementer and a separate reviewer reach the **same** verdict. Read it before writing
any new wave charter or revising one.

> This standard exists because W0 and W1 (PRs #112/#113) drew heavy "changes requested"
> reviews while the design corpus drew none. The difference was not the implementer — it was
> that the corpus charters only had to pass *design* review (prose judged for coherence),
> and the wave charters had to pass *code* review (done-conditions judged for proof). The
> rules below close that gap.

---

## 1. The one principle: write for the implementation gate, not the design gate

A design charter can be coherent prose and pass — a human judges whether the *design* hangs
together. A wave charter drives **code** through an adversarial reviewer who re-derives the
spec and does not trust the implementer. That gate demands **countable, falsifiable
done-conditions**. A charter like *"resolution precedence exactly as specified"* passes design
review and fails code review, because the implementer and the reviewer each decide privately
what "as specified" means and disagree.

Three consequences — they become the hard rules in §2:

1. **Evidence over prose applies to charters too** (invariant 7). A charter states *checkable
   conditions and the evidence that proves them*, not intentions.
2. **One shared rubric.** The implementer and the independent reviewer must grade against the
   *same enumerated list*. A bar that lives only in the reviewer's head — or only in the review
   prompt — guarantees divergence.
3. **High-altitude on HOW, precise on DONE.** The charter never dictates file layout,
   signatures, or algorithms — the senior implementer owns those. It always enumerates
   acceptance criteria, failure outcomes, and required evidence.

> **Altitude governs HOW. Acceptance criteria govern DONE.** These never conflict: keep HOW
> free, keep DONE pinned. "Implementers own signatures" is about *internal* layout — where the
> normative spec names a type, shape, or semantic, it is binding (that is spec surface, §R1).

---

## 2. The five hard rules

Each rule fixes a defect class that actually shipped in W0/W1. A charter that violates any of
them is not ready to dispatch (§5, Gate A).

### R1 — Enumerate acceptance criteria, and list the spec surface

Every item charter carries an ordered list of **`AC-n`** — single, falsifiable assertions —
and a **spec-surface manifest**: the names of the interfaces, events, and failure modes the
normative spec defines. *Done* = every AC met and every manifest item present with the spec's
names/shapes/semantics.

- An AC is falsifiable against a test: *"AC-4 a staged deletion makes `clean()` return
  `false`"* — not *"handles git status correctly."*
- The manifest turns *"every interface/event/failure-mode implemented"* into something
  countable, instead of a contest of whose independent reading was more thorough.
- **Why:** with no AC list, implementer and reviewer re-derived the spec independently and
  disagreed — W1's untested fail-closed paths and uncovered redaction forms are this defect.

### R2 — Name every failure and degraded outcome as a first-class token

For each way the item can fail or degrade, the charter gives a row: **token · trigger ·
required behavior · the AC that proves it.** Bare prose like *"fail closed"* or *"degrades
safely"* is not enough.

- **Why:** every W1 blocker landed exactly here — the audit was bypassed when no writer was
  configured; authoritative writes continued while the filesystem was degraded; a lease renewed
  after its TTL expired. Failure behavior is contract, so it goes in a table, not an adjective.

### R3 — Quantify the quality bar, and wire it into the gate

- **State the coverage number** (per [`AGENTS.md`](../../AGENTS.md): 90% minimum, aim 95%)
  **and how it is enforced.** The verify gate `pnpm check` does **not** currently run a
  coverage threshold (confirmed in W1: `vitest run` ran with no `--coverage`). So an item with
  a coverage obligation must either wire the threshold into its test lane / the gate, or the
  charter names the exact command that checks it. *"Coverage bar met"* with no number and no
  enforcement is unverifiable — and was.
- **List required tests as a catalogue, not examples.** *"property + integration tests
  (e.g. …)"* lets the implementer choose the easy cases. Enumerate the properties and the hard
  cases each AC needs.
- **Restate the non-negotiables that bite at review:** file ≤ 800 lines; no ambient
  `Date.now`/`Math.random` (clock/id are injected ports); no SDK outside its
  [`package-map.md`](./package-map.md) boundary; redaction proven; immutability.

### R4 — The charter is a subset of the spec; reconcile before dispatch

- The normative domain spec (`docs/design/domains/<layer>/<id>/README.md` + sibling aspect
  files) **wins**. The charter points at it and makes it countable; it **never asserts a
  requirement the spec does not contain.**
- **Why:** in W1 a charter demanded a credential boundary be *"structural, not conventional"*
  while the spec only supported a runtime predicate. The **charter** was wrong and had to be
  amended — the implementer was right. A charter that out-runs its spec manufactures false
  findings.
- Before dispatch, **diff every AC against the spec.** An AC with no spec basis is a defect:
  raise it and fix the spec first, or drop the AC.

### R5 — No optional branches in a reconciliation or cross-cutting item

- A charter that says *"do A, **or** do B"* hands a design decision to the implementer and
  leaves every downstream item guessing which path was taken.
- **Why:** W0 said *"normalize tokens to kebab-case **or** ratify an exception"* and *"add the
  fields to fnd-01 **or** revise fnd-04."* The result was snake_case tokens left stale in
  consumer docs and soft credential-seam fields that W1 inherited.
- **Resolve the branch when you author.** Pick A, name the concrete output (the exact field
  names, the exact tokens), and give the **sweep command** that proves no straggler remains
  (`rg 'some_snake_token' docs/ → 0 hits`). A cross-corpus change is done only when the grep is
  clean and quoted in the evidence pack.
- **Producer/consumer pairs name the shape once.** When item X produces a contract item Y
  consumes (e.g. `fnd-01` → `fnd-04`), X's charter states the exact shape and Y's charter cites
  it verbatim — never *"the fields X supplies."*

---

## 3. The wave-charter template

Copy this block. Keep it to the wave's framing; the per-item detail lives in §4.

```markdown
---
title: "Wave <N> — <Name>"
wave: <N>
status: "wave: draft"            # draft -> ready -> in-progress -> done
depends-on-waves: [<...>]
delivers-as: "single PR into v-next"
last-updated: <YYYY-MM-DD>
---

# Wave <N> — <Name>

**Goal.** <one sentence: the substrate or capability this wave stands up>.

**Frozen inputs.** <prior-wave outputs this wave consumes, named: package map, policy docs,
specific prior packages>.

## Work items (one commit each; the coordinator plans agent delegation)

Build order follows the DAG: <intra-wave order + deps, from README.md>.

- [`<id>` — <name>](./items/<id>.md) — <one line>; produces <named cross-corpus output, if any>.

## Scope & boundaries

- *In:* <the layer/surface this wave owns>. *Out:* <what looks in-scope but is not — each
  handed to the owning wave/domain by id>.
- Dependency Rule: activate/keep green <the exact dependency-cruiser rule for this layer>.
  New runtime deps permitted: <exact list, or "none">.

## Integration

<how the items wire together: tsconfig solution references, dependency-cruiser coverage,
injected clock/id ports, a composition smoke if applicable>.

## Wave definition of done

- *Spec compliance:* every item's AC list met and independently verified impl-vs-spec.
- *Quality bar:* `pnpm check` green; coverage >= <bar> enforced; required tests present; the
  layer rule active; no SDK or cross-layer import.

## Wave checklist

- [ ] Every item committed; each reviewed against its charter **AC list** AND its domain spec.
- [ ] Spec compliance confirmed per item (no invented requirements; any spec gap surfaced + amended).
- [ ] Packages wired into the tsconfig solution + dependency-cruiser; <layer> rule active & green.
- [ ] Clock/id injected; no `Date.now`/`Math.random` in this wave's code.
- [ ] `pnpm check` green; coverage >= <bar> (number pasted as evidence).
- [ ] Only <permitted deps> added; SDK placement (package-map.md) respected.
- [ ] `readiness-matrix.md` updated with cited executable evidence for each item.
- [ ] No out-of-scope changes; one PR opened against `v-next`.

## Out of scope / deferred

<explicit list; name the wave or domain that picks each up>.
```

---

## 4. The work-item charter template (the heart)

This is where R1–R5 live. Copy this block per item.

```markdown
---
title: "<id> — <Name> — implementation charter"
id: "<id>"
wave: <N>
layer: "<foundation|contracts|core|edge|drivers>"
status: "item: draft"            # draft -> ready -> in-progress -> done
spec: "docs/design/domains/<layer>/<id>-<name>/"
---

# <id> — <Name>

**Purpose.** <one sentence: the item's single job, tied to its FR/NFR and AD ids>.

**Spec (normative).** Implement `<spec path>` (README.md + sibling aspect files). The
<list the binding contracts: resolution / injection / merge predicate / ...> are normative.
Ambiguous or under-specified -> **STOP and surface** to the architect; do not invent.

## Spec surface (manifest)

What the normative spec defines and the implementation must expose/consume, by name:

- **Interfaces / types:** <names>.
- **Events / append intents:** <names>.
- **Failure & degraded outcomes:** <tokens — detailed in the table below>.

(Done requires every item here present, with the spec's names, shapes, and semantics.)

## Responsibilities (in scope)

- <positive obligations, specific enough to distinguish this item from its siblings>.

## Out of scope

<what a naive implementer would absorb here, each handed to the sibling that owns it by id>.

## Requirements owned

<FR/NFR ids> + full <id> design-spec compliance.

## Dependencies & frozen contracts

Depends on <ids + exactly what for>. Depended on by <ids>. Must NOT depend on <forbidden
direction, per the Dependency Rule>.

Cross-item contracts (named, per R5 — never "the fields X supplies"):
- `<exact shape, e.g. PolicyLayer.credentialRef: { id: string; source: "env" | "file" }>`.

## Acceptance criteria (the shared rubric)

Each AC is a single assertion that is true or false against a test. No "exactly as specified".

- **AC-1** <falsifiable assertion> — test: <name or idea>.
- **AC-2** <...>.

## Failure & degraded outcomes (first-class)

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `<kebab-token>` | <condition> | <fail closed / refuse / park / ...> | AC-<n> |

## Quality bar

- Coverage >= <90% min / 95% aim>, enforced by <exact command or lane>.
- Required tests (catalogue, not examples): <enumerate the properties and hard cases each AC
  needs — the cases a reviewer would otherwise add at review time>.
- File <= 800 lines; clock/id injected (no ambient time/randomness); no SDK outside
  <boundary>; <domain non-negotiables, e.g. no secret value in source or test output>.

## Required reading

This item's spec (README + aspect files); <policy docs>; <named decisions AD-*>; <named
sibling contracts>. Nothing else.

## Deliverable

The <package> providing <the surface from the manifest>, plus the **evidence pack**: a test
named per AC and per failure-outcome row; `pnpm check` output + the coverage number; the
sweep-grep results for any cross-corpus change; the provider `evidence/` appendix if applicable.

## Boundaries

Stay in <package>; never <domain hard stop, e.g. print or persist a secret>. **STOP and
surface** (do not edit another package or guess) when: <the specific cross-item questions that
would otherwise tempt a guess>.
```

---

## 5. The three verification gates

One rubric, checked at three points. All three key off the **same AC list and
failure-outcome table** — that shared rubric is what stops implementer and reviewer from
diverging.

### Gate A — Pre-dispatch readiness (the architect, before handing the wave to the coordinator)

The cheapest place to catch every defect above. A wave is dispatch-ready only when, **for
every item**:

- [ ] AC list present; every AC is falsifiable and traces to a spec line (R1, R4).
- [ ] Spec-surface manifest present and matches the spec (R1).
- [ ] Failure-outcome table present; every named state has a proving AC (R2).
- [ ] Coverage number **and** its enforcement stated; required-test catalogue present (R3).
- [ ] Zero optional branches; cross-item contracts name exact shapes; sweep commands given (R5).
- [ ] Boundaries: owned package, the Dependency-Rule edge, and the explicit STOP-and-surface
      triggers.
- [ ] The item's ACs are mirrored **verbatim** into the reviewer prompt (one shared rubric, §6).

If any box is empty, the charter is not ready. Fix it before spawning an implementer.

### Gate B — Implementer self-verification (before declaring the item done)

- [ ] Every AC has a passing test, named in the summary.
- [ ] Every failure-outcome row has a test that triggers it and asserts the behavior.
- [ ] `pnpm check` green (output pasted); coverage at/above the bar (number pasted).
- [ ] No manifest item missing; **no requirement invented beyond the spec.**
- [ ] Evidence pack produced (below). Any spec ambiguity was STOPed and surfaced, not guessed.

### Gate C — Independent review (a separate session; objective, AC-keyed)

The reviewer verifies against the **same AC list**, not a private re-derivation:

- For **each AC**: met / not-met, with the `file:line` and the test that proves it.
- For **each failure-outcome row**: proven / not-proven.
- **Spec compliance:** every manifest item present; names/shapes/semantics match; no invented
  requirement (a charter/spec conflict is a [strong] note to the architect, not a block — R4).
- **Quality bar:** gate green and coverage >= bar (re-run, do not trust); file caps; no ambient
  time/randomness; Dependency Rule + SDK placement.
- **Verdict:** APPROVE / CHANGES-NEEDED, naming the AC ids / rows that gate it.
- On APPROVE, update [`readiness-matrix.md`](./readiness-matrix.md): move the item's
  *package-implemented* axis to `yes` **with cited executable evidence** — the matrix's own
  rule forbids moving it on design, prose, or a self-report.

Disagreement resolves against the AC list, not opinion. Only a genuine spec gap escalates to
the architect (and amends the spec).

### The evidence pack (handed from implementer to reviewer — evidence over prose)

- The test name per AC and per failure-outcome row.
- `pnpm check` output and the coverage number.
- The sweep-grep results for any R5 cross-corpus change.
- For provider items: the dated `evidence/` appendix (exact commands, output hashes, schema
  snapshots) per [`conventions.md`](../design/conventions.md).

The reviewer **confirms** this pack. It must never have to reconstruct it from scratch.

---

## 6. Prompt requirements and templates

Three prompts run a wave: the **coordinator** (orchestration), the **implementation** prompt,
and the **review** prompt. The coordinator owns flow; the other two carry the rubric. The
handoff prompts are part of the contract, not freeform. They must:

- Give the implementer **and** the reviewer the **same AC list and failure-outcome table** —
  paste them in, or have both read the same item charter. **The reviewer prompt must contain no
  acceptance bar the implementer prompt lacks.** (W1: *"structural, not conventional"*, the
  exact no-subprocess greps, and *"no secret in test output"* read sharper to the reviewer than
  to the implementer — the implementer was graded on a rubric they were not handed.)
- Scope the reading symmetrically: the implementer reads ONLY the item charter + its normative
  spec + named policy docs + named siblings/decisions; the reviewer reads that same set **plus**
  the diff. Neither side may judge a contract that lives in a doc the other was told not to read.
- State the loop: implement -> independent review -> fix -> re-review; **3-round cap ->
  escalate** to the architect with both positions.
- Pin the mechanics from [`README.md`](./README.md) / [`AGENTS.md`](../../AGENTS.md): the
  orchestration manages the worktree/branch (no hard-coded paths); one commit per item on
  approval; one PR per wave into `v-next`; `pnpm check` before the PR; never push to `v-next`.
- Frame review authority correctly: a reviewer's belief that an invariant or the spec itself is
  wrong is a [strong] note to the architect (it amends the spec, R4) — it does not block the
  item on the reviewer's opinion.

Fill the `<...>` slots from the item charter. **Paste the AC list and the failure-outcome table
verbatim into both** the implementation and review prompts — that shared rubric is the whole
point (§5). Do not paraphrase them differently in each.

### 6.1 The implementation prompt

```text
You are the IMPLEMENTER for work item <id> — <Name> of kit-vnext Wave <N>.
Reasoning effort: <high|xhigh>. You build; you do NOT commit (the coordinator commits on approval).

Read ONLY (nothing else):
- your charter: <charter path>
- the normative domain spec: <spec dir> (README.md + sibling aspect files)
- policy: <dependency-policy.md, testing-policy.md, ...>
- named siblings / decisions: <...>

Build the package the charter's Deliverable describes. It is DONE only when ALL hold:
- Every acceptance criterion holds, each with a passing test:
    <paste AC-1..n verbatim from the charter>
- Every failure / degraded outcome is implemented and tested:
    <paste the failure-outcome table verbatim>
- Spec surface complete: every interface/type/event/failure-mode in the manifest is present
  with the spec's names, shapes, and semantics. Invent nothing the spec does not require.
- Quality bar: `pnpm check` green; coverage >= <bar> (run: <the coverage command>);
  file <= 800 lines; clock/id injected (no ambient Date.now / Math.random); no SDK outside
  <boundary>; <domain non-negotiables, e.g. no secret value in source or test output>.

Stay inside <package>. Respect the Dependency Rule (<the edge>). If a cross-item contract
question is not answered by the spec, STOP and surface it to the coordinator — do not guess and
do not edit another package.

Finish with the EVIDENCE PACK: the test name proving each AC and each outcome row; `pnpm check`
output + the coverage number; sweep-grep results for any cross-corpus change; the provider
`evidence/` appendix if applicable; and a one-line note on any STOP you raised.
```

### 6.2 The review prompt

```text
You are an INDEPENDENT ADVERSARIAL REVIEWER for work item <id> — <Name> of kit-vnext Wave <N>.
Reasoning effort: <high|xhigh>. You did not write this code and do not trust it. Review only —
do not fix, commit, or merge.

Read: the charter (<charter path>), the implementer's diff, the normative spec (<spec dir>), and
<the SAME policy docs / siblings the implementer read>. Read no contract the implementer was told
not to read; raise nothing the charter did not require.

Verify against the charter's own rubric — do not invent a new bar:
- Each acceptance criterion — met / not-met, with file:line and the test that proves it:
    <paste AC-1..n verbatim>
- Each failure / degraded outcome — proven / not-proven:
    <paste the failure-outcome table verbatim>
- Spec compliance — every manifest item present; names/shapes/semantics match; no invented
  requirement. (A charter that demands more than the spec is a [strong] note to the architect,
  not a finding against the code — R4.)
- Quality bar — RE-RUN `pnpm check` (do not trust the report); coverage >= <bar>; file <= 800
  lines; no ambient Date.now / Math.random (grep); Dependency Rule + SDK placement; <domain
  greps, e.g. no child_process in fnd-03; no secret in source or test output>.

Output:
- a per-AC table (id | met? | file:line | proof) and a per-outcome table (token | proven?);
- findings tagged [blocking | strong | minor], each with file:line, a concrete fix, and the AC
  id / outcome token it gates;
- a verdict: APPROVE or CHANGES-NEEDED, naming the ACs / tokens that gate it.

Disagreement resolves against the AC list; only a genuine spec gap escalates to the architect.
On APPROVE, the coordinator updates readiness-matrix.md (package-implemented -> yes) with the
cited evidence.
```

---

## 7. A worked fragment: prose vs enumerated

From a real W1 blocker (fnd-04 redaction).

**Wrong — what shipped:**

> *Quality bar:* redaction proven (property tests: no secret survives a log/telemetry/artifact
> path).

The property test was tautological; secrets used as object **keys** and base64-encoded forms
leaked through. The reviewer raised a blocker, and the fix changed both the logic and the test.

**Right — enumerated:**

> **AC-7** No secret value appears in any log, telemetry, or artifact output, for every secret
> position and encoding.
>
> Required tests (property):
> - secret as a value -> redacted
> - secret as an **object key** -> redacted
> - secret **base64-** and JSON-escaped -> redacted
> - secret embedded in an **error message / stack** -> redacted
>
> Failure-outcome row:
>
> | token | trigger | required behavior | proven by |
> |---|---|---|---|
> | `redaction-unavailable` | a path that requires redaction has no hook | refuse the write; never emit unredacted | AC-8 |

Now the implementer builds to four enumerated cases and the reviewer checks the same four.
There is nothing left to privately re-derive, so there is nothing to diverge on.

---

## 8. The authoring workflow (slice to dispatch)

1. **Slice the wave** from the DAG in [`README.md`](./README.md): items whose dependencies are
   satisfied; one commit each.
2. **Read each item's normative spec** + the policy docs; extract the spec-surface manifest.
3. **Write the item charter** from the §4 template: ACs, manifest, failure table, quality bar,
   boundaries.
4. **Reconcile (R4/R5):** diff every AC against the spec; resolve every "A or B"; name every
   cross-item shape; write the sweep commands.
5. **Self-run Gate A.** An empty box means not ready.
6. **Fill the coordinator + reviewer prompts** from §6; paste the same ACs into both.
7. **Dispatch:** implementer (Gate B) -> independent reviewer (Gate C) -> loop -> one PR into
   `v-next`.
8. **On merge,** update [`readiness-matrix.md`](./readiness-matrix.md) with cited evidence.

---

## 9. Quick reference (tear-off)

A wave is **ready to dispatch** when every item has:

☐ falsifiable `AC-n`  ☐ spec-surface manifest  ☐ failure-outcome table  ☐ coverage number
+ enforcement  ☐ required-test catalogue  ☐ zero optional branches  ☐ cross-item shapes named
☐ sweep commands  ☐ ownership + STOP triggers  ☐ ACs mirrored into the reviewer prompt.

An item is **done** when Gate C confirms every AC and every failure-outcome row on cited
evidence, `pnpm check` is green at/above the coverage bar, and the readiness matrix is updated.

**The five rules, in one line each:** R1 enumerate ACs + manifest · R2 name failure outcomes ·
R3 quantify + enforce the quality bar · R4 charter ⊆ spec · R5 no optional branches.
