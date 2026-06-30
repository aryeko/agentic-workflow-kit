# 06 - Final Synthesis

## Verdict

Recreate the Jig product layer by collapsing the new PRD subtree into a simpler canonical
product layer. The branch has useful raw material, but the current shape is too complex
for the goal: product-only, clear, high-quality, and intentionally not bounded by the
current design or implementation.

The recommended rewrite path is:

1. Use a value-proposition / jobs-to-be-done pass as the spine for the next canonical
   `docs/product/jig.md`.
2. Keep `docs/product/README.md` as the suite-level product definition.
3. Remove `docs/product/prds/` from the canonical product layer unless the owner later
   asks for a separate archived PRD artifact, and only after each AC family has a named
   destination.
4. Mine `docs/product/jig.candidate.md` and the PRD tree for useful language only; do not
   use either artifact as the structural seed.
5. Move protocol-level acceptance criteria, driver specifics, exact schema mechanics,
   protected-file semantics, and phase exit bars back to design, roadmap, or delivery
   planning artifacts.

## Layer Authority

Authority flows from product intent to design implementation. Product owns the audience,
problem, promise, user-visible guarantees, boundaries, and success signals. Design is the
current engineering reference for how those commitments are satisfied, not a constraint on
what the product is allowed to mean. When product intent and current design conflict, the
conflict should be named and reconciled explicitly: either design changes to satisfy the
product commitment, or product records an open product question and narrows the promise.
Moving protocol ACs "back to design" does not mean design owns the promise. It means product
keeps the outcome-level commitment while design owns the mechanism, schema, sequencing, and
conformance proof.

## Red-Team Constraints

The red-team pass agreed with the collapse recommendation but found two blocking
constraints to satisfy before implementation:

- Do not delete or collapse the PRD tree until ID-bearing AC families have a migration
  map. Product-only does not mean losing traceable commitments.
- Do not copy `docs/product/jig.candidate.md` wholesale. It is useful source material, not
  a clean source of truth; it still contains PRD links, phase commitments, driver lanes,
  and schema mechanics.

## Target Tree

| Path | Target role |
|---|---|
| `docs/product/README.md` | Suite-level product definition: audience, why this exists, product promise, workflow, suite map, product/design authority boundary |
| `docs/product/jig.md` | Canonical Jig product page: audience, user job, problem, promise, workflow, five guarantees, boundaries, success signals, open product questions |
| `docs/product/concepts.md` | Durable cross-product concepts only, such as tracks, if readers need them |
| `docs/product/supporting-products/*.md` | Short orientation pages for optional upstream/supporting products |
| `docs/product/status.md` | Transitional workstream/status only; delete or archive once product shape stabilizes |

No committed `docs/product/prds/jig/` 10-file PRD tree should be canonical for this
rebuild. If requirements tables are still needed later, they should be produced as
delivery/design inputs that cite the canonical product page rather than redefine it.

## Candidate Status

Treat `docs/product/jig.candidate.md` as a **local-only source**, not a tracked product
page and not a tracked archive. It should not remain under `docs/product/`, because
docs-nav treats any markdown file there as a real product page and rewrites neighboring
footers around it. For this review packet, the local source should live outside the docs
tree, for example at `.codex/local-sources/jig.candidate.md`, and the implementation pass
should mine it there for language. After the rewrite lands, delete the local copy unless
the product owner explicitly requests a tracked historical archive.

## Value-Proposition Spine

The next `docs/product/jig.md` should be built from this product spine, not from the
candidate's section order and not from the PRD tree:

| Question | Rewrite answer should establish |
|---|---|
| User | The owner/operator who has product and design judgment but cannot safely supervise every agent action manually |
| Job | Turn an approved execution plan into reviewed, landed work while preserving human control |
| Current alternative | A chain of one-off agent sessions, manual PR/review follow-up, ad hoc notes, and fragile recovery |
| Before | The owner cannot tell whether the agent stayed inside policy, what evidence justified a merge, or how to resume safely after interruption |
| After | The owner delegates execution under policy and receives evidence, escalation points, recovery, and a reconstructible outcome |
| Non-fit | Jig is not a product-definition tool, a design authoring tool, an LLM project manager, or a way to bypass review judgment |
| Success signal | Runs land with fewer unsafe surprises, lower review burden, clear evidence, and recoverable progress |
| Counter-signal | Product docs become long mechanism tables, owners must inspect protocol fields to understand the promise, or design defaults harden into product truth |

## Keep / Drop / Move

| Current item | Decision | Destination / handling |
|---|---|---|
| `docs/product/jig.candidate.md` | Keep local-only, outside docs navigation | Mine for language during rewrite; do not track it as a parallel product page |
| `docs/product/jig.md` | Rewrite | Replace with a concise canonical product page built from the value-proposition spine |
| `docs/product/README.md` | Keep and trim | Keep suite framing; remove language that makes the PRD subtree canonical |
| `docs/product/status.md` | Trim or archive | Keep only transient status; move process history to review/workstream artifacts |
| `docs/product/prds/README.md` | Drop from canonical product layer | Remove unless explicitly archived as non-canonical source material |
| `docs/product/prds/jig/01-context.md` | Mine then collapse | Fold product problem/audience/promise language into `docs/product/jig.md` |
| `docs/product/prds/jig/02-principles.md` | Mine then collapse | Keep product principles in prose, not a separate PRD section |
| `docs/product/prds/jig/03-domain-model.md` | Move most content | Product-visible nouns can go to `concepts.md`; modeling belongs in design |
| `docs/product/prds/jig/04-roles.md` | Mine personas only | Drop or move capability matrices to planning/design |
| `docs/product/prds/jig/05-phases.md` | Move | Roadmap/planning owns exact phases and exit bars |
| `docs/product/prds/jig/06-quality-bars.md` | Move | Design/verification owns detailed NFR checks |
| `docs/product/prds/jig/07-success-metrics.md` | Keep conceptually | Fold high-level success and counter-signals into `jig.md` |
| `docs/product/prds/jig/08-acceptance-criteria.md` | Move out of product | Design/planning owns protocol ACs, policy mechanics, hook returns, driver proof details |
| `docs/product/prds/jig/09-risks-and-open-questions.md` | Mine product questions | Keep only product uncertainty in `jig.md`; move design risks elsewhere |
| `docs/product/prds/jig/10-glossary.md` | Merge selectively | Product-facing terms can move to `concepts.md`; avoid duplicate vocabulary authority |
| `docs/design/README.md` nav change | Revert with PRD collapse | It should not point from design overview into a removed PRD subtree |

## AC Family Migration

Before removing `docs/product/prds/jig/08-acceptance-criteria.md`, classify every AC family
and move it deliberately:

| AC family | Product disposition | Destination |
|---|---|---|
| `FENCE` | Keep product-visible trust boundary; move mechanism detail | `docs/product/jig.md` for promise; design/security specs for request paths and enforcement |
| `EARN` | Keep capability-proof promise; move probe mechanics | `docs/product/jig.md` for "autonomy is earned"; design provider/capability specs for proof shape |
| `GUARD` | Keep anti-gaming promise; move protected-file semantics | `docs/product/jig.md` for invariant; design/policy specs for file sets and re-approval flow |
| `DOOR` | Keep escalation promise; move risk tables and timeout policy | `docs/product/jig.md` for owner decision points; design/policy specs for classifier details |
| `MERGE` | Keep merge-on-evidence promise | `docs/product/jig.md` plus design completion/merge specs for exact evidence predicates |
| `CFG` | Keep policy/profile concepts; move defaults and computed-actual mechanics | `docs/product/jig.md`, `docs/product/concepts.md`, and design/config specs |
| `RESUME` | Keep safe-resume promise; move checkpoint/idempotency mechanics | `docs/product/jig.md` and design recovery specs |
| `ISO` | Keep fault-isolation promise; move dependency-graph mechanics | `docs/product/jig.md` and design/planning specs |
| `STACK` | Keep stack-portability promise; move driver lists and adapter phasing | `docs/product/jig.md`; roadmap/design for drivers |
| `SEE` | Keep observability promise; move event schema/export fields | `docs/product/jig.md`; design event-log/observability specs |
| `PLAN` | Keep one hard input boundary; move field-level schema | `docs/product/README.md`/`jig.md` for boundary; design/schema docs for fields |
| `SURF` | Keep product access surfaces only where user-facing | Roadmap/planning for CLI/skill/MCP sequencing and exact surface scope |

The migration bar is not that every AC ID survives in product. The bar is that no
traceable commitment disappears silently.

## Concrete AC Translation Example

This is the kind of row that should not remain as product-layer prose:

| Source AC | Why it is too low-level for product | Product-altitude rewrite |
|---|---|---|
| `GUARD-5`: "A file is considered protected by one of two mechanisms: (1) the system-inferred set — CI configuration files, the active policy file, gate setup files, and verification configuration — which is always protected and cannot be excluded by per-track policy; or (2) a policy-declared protected-path list that the user extends with glob patterns. The policy-declared list may extend but not shrink the system-inferred set. A story that writes to any file matching either mechanism triggers the GUARD-2 re-approval flow." | It defines file categories, policy-list mechanics, and trigger semantics. Those are design/policy contract details. | Jig will not let a run quietly change the rules it is running under. If work touches files that govern policy, verification, or integration safety, the run pauses for explicit owner re-approval and fresh evidence before completion continues. |

The product rewrite keeps the trust promise. Design owns the exact protected-file
classification, glob behavior, event records, and re-approval protocol.

## Candidate Mining Checklist

Use the local-only candidate only through this filter:

| Candidate material | Action |
|---|---|
| Audience, current pain, long-running loop problem | Keep and sharpen |
| One-sentence promise and "execution plan + policy in" framing | Keep |
| Five guarantee structure | Keep, with product-facing names and short explanations |
| Configuration, policy dial, recovery, stack, observability sections | Keep as concepts; remove implementation detail |
| Personas | Keep if concise and user/job-oriented |
| PRD links and statements that PRD owns behavioral requirements | Remove or rewrite |
| Phase 0/1/2 rows and driver sequencing | Move to roadmap/planning |
| Seam/driver tables and adapter names | Translate to "works with your stack"; move specifics |
| Execution-plan story fields and AC-reference mechanics | Move to schema/design docs |
| Diagrams that show runner/worker/gate mechanics | Keep only if they explain user-visible trust; otherwise move to design |

## Rewrite Handoff

Give the implementation agent this contract:

1. Work in the `jig-prd` worktree and verify branch/status before edits.
2. Keep `jig.candidate.md` local-only and outside `docs/product/`; mine it for useful
   language, then delete the local copy after the rewrite is accepted unless an archive is
   explicitly requested.
3. Start from the value-proposition spine: user, job, current alternative, before outcome,
   after outcome, non-fit, success signal, and counter-signal.
4. Rewrite `docs/product/jig.md` as the single canonical Jig product page.
5. Keep product altitude: audience, problem, promise, workflow, guarantees, product
   boundaries, success signals, and open product questions.
6. Do not copy the PRD tree structure.
7. Do not define exact event fields, hook return tokens, protected-file glob rules,
   driver probe mechanics, or exact phase exit demonstrations in product docs.
8. Apply the AC family migration table before removing PRD files.
9. Update product navigation and status so the canonical shape is clear.
10. Run a stale-reference sweep for `prds/jig`, `Jig PRD`, `FENCE-`, `EARN-`,
    `GUARD-`, `DOOR-`, `MERGE-`, `CFG-`, `RESUME-`, `ISO-`, `STACK-`, `SEE-`,
    `PLAN-`, and `SURF-`.
11. Regenerate/check docs navigation, then run the repo gate.

Acceptance bar:

- One reader can understand Jig's audience, promise, workflow, boundaries, and five
  guarantees from `docs/product/jig.md`.
- Product/design ownership is explicit: product owns what and why; design owns how.
- The product layer is shorter than the current PRD subtree and does not require accepting
  the existing design as product truth.
- Open product questions remain visible instead of being turned into ship-blocking
  implementation ACs.
- Any retained AC identity has a named product, design, roadmap, or planning home.

## Report Packet

- `01-product-layer-read.md`: product intent and complexity/design-bias symptoms.
- `02-design-reference-behaviors.md`: product-visible behaviors to preserve from design,
  translated out of design vocabulary.
- `03-product-skills-inventory.md`: PM/product references to use as methodology, not
  dependencies.
- `04-rebuild-recommendation.md`: concrete collapse-and-rebuild recommendation.
- `05-red-team.md`: adversarial review of this packet.

## Verification

Completed 2026-06-30:

```text
pnpm exec biome format --write docs/reviews/2026-06-30-jig-product-layer-rebuild
CI=true pnpm docs:nav
pnpm check
```

Results:

- `pnpm exec biome format --write ...` exited non-zero because the docs review path is
  ignored by Biome config: no files were processed.
- Initial `pnpm check` failed only on `docs:nav:check`, which reported generated nav out
  of date.
- The untracked candidate source was moved from `docs/product/jig.candidate.md` to
  `.codex/local-sources/jig.candidate.md` so it is local-only source material rather than a
  generated docs page.
- `CI=true pnpm docs:nav` updated generated footer links for the committed docs tree
  (`370` markdown files after removing the candidate from docs navigation).
- Final `pnpm check` passed: `docs:nav:check` reported nav up to date and all 8 Turbo
  tasks succeeded. It printed the existing Biome warning/info for
  `packages/sdk/src/core/supervision/contracts/interfaces.ts` and
  `packages/sdk/tests/core/supervision/wait/wait-wrapper.unit.test.ts`, but the command
  exited 0.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig product layer rebuild review](./README.md) · **← Prev:** [05 - Red-Team Review (R05-RED-TEAM)](./05-red-team.md) · **Next →:** [Jig product layer rebuild review](./README.md)

<!-- /DOCS-NAV -->
