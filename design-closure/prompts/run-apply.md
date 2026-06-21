# Run Apply — land the approved closure proposals into the design corpus, then verify readiness

You are a fresh session with no memory of prior conversation. Your job: **apply** the approved
design-closure proposals (Waves 1–3) into the live kit-vnext design corpus, then **verify** the design
is complete and ready to start implementation core-first.

## Setup
1. Confirm you are in a working copy that contains the corpus (`docs/design/30-domain-reference/` must
   exist) and the closure package (`design-closure/outputs/`), and that you are not in the repo's
   primary checkout. If either is missing, stop and report.
2. Read `design-closure/README.md` — the rules, the **Quality guardrails**, and the deliverable format.
3. Read the approved, frozen inputs:
   - `design-closure/outputs/wave-1/WAVE-1-SUMMARY.md` + the `T1`–`T4` proposals and drafts;
   - `design-closure/outputs/wave-2/WAVE-2-SUMMARY.md`, `WAVE-2-RULINGS.md` (approved) + `T5`–`T8`;
   - `design-closure/outputs/wave-3/WAVE-3-SUMMARY.md`, `WAVE-3-RULINGS.md` + `T9` and its drafts.
   Confirm the rulings sheets are marked approved. If any ruling you need is still `DRAFT`/unapproved,
   stop and report — do not guess it.

## What is different about THIS session
Every wave so far only wrote proposals. **This session edits the live corpus under `docs/**`.** You are
applying decisions that are *already approved* — you are **not** making new design decisions. Apply
faithfully. If a proposal is ambiguous, conflicts with the corpus in a way the rulings do not cover, or
depends on a ruling that is not approved, **stop and flag it** rather than inventing a resolution.

## The job — apply in dependency order
Each proposal has a **Corpus impact** list (exact files + sections) and a `draft/` with the content to
land. Use those as your checklist. Honor the approved rulings throughout.

1. **Foundation typed contracts.** Land T4 (fnd-02 storage types) at the file it names; freeze the T1
   fnd-01 policy fields (per T1 + the approved Wave-2 rulings, incl. `approval.decisionWindowMs` default
   and the `merge` key); land T5 (fnd-03 event payload types + the approved concurrency policy).
2. **SDK port hoist + naming.** Land T3 (the SDK-owned `provider-ports.md` with the four ports +
   `CapabilityAttestation`). **Apply R-T9.4**: adopt the SDK `*Provider` names as canonical and
   rename/alias the four provider deep-specs accordingly.
3. **Core closures.** Land T6 (core-03: decision-window default, the `PolicyGrantPlan → ScopedGrant`
   mapping, fail-closed unmapped grant kinds), T7 (core-05: required-evidence source + blocker-PR rules
   per the approved rulings, plus the F-1 prov-02 ruleset field and the F-2 prov-04 `commandDigest`
   contract — land the minimal hook; where T7 deferred exact membership to the prov-04 owner, record it
   as a tracked TODO rather than fabricating it), and T8 (the event durability map).
4. **Legibility reorg.** Land T9: re-point each core→provider edge in the DAG to its
   `seam-<provider>-contract-mock` node; add the contract+mock vs real-driver story-class splits to the
   provider frontier charters; reclassify runtime attestation as a production-readiness gate in the
   readiness matrix; fix the published build order; apply the optional attestation clarifier if
   R-T9.3 was approved.
5. **Bookkeeping.** A-1: re-sync each domain's frontmatter `prov-*` dependencies to the seam nodes.
   A-2: real-driver stories/attestation are **reclassified, never deleted**.

## Guardrails (still binding)
Smallest faithful change; apply only approved content; do not silently narrow (especially real-driver
stories/attestation). If the corpus uses generated navigation/index footers (marked
"generated — do not edit by hand"), run the generator rather than hand-editing them.

## Verify completeness + readiness
After applying, confirm and record evidence that:
- every core domain's previously-open blocking question is now closed *in the corpus*;
- the typed shared contracts exist in one owned location;
- the build order reads foundation → seam ports & mocks → core spine → core gates → real drivers (parallel) → edge;
- the readiness matrix shows runtime attestation as a production gate, not a core build/test prerequisite;
- no dangling `prov-*` dependency references remain after the frontmatter re-sync;
- provider-interface naming is consistent after R-T9.4.
Run the repo's verification gate if one exists (e.g. `pnpm check`, docs nav/lint) and show its output.

## Output + stop
- The corpus edits, committed on the **current branch** (or a dedicated apply branch). Confirm
  `git rev-parse --show-toplevel` before committing. **Do not push to a protected branch** (e.g.
  `v-next`); leave merge/PR strategy to the architect.
- A report at `design-closure/outputs/apply/APPLY-REPORT.md`: file-by-file what changed; anything you
  deferred, flagged, or stopped on; the verification-gate output; and a plain readiness verdict — is the
  design now buildable core-first, and what (if anything) is still open?
- **Stop for architect review.** Do not start writing implementation stories or code.

Report back with the apply-report path, a short digest, and anything you stopped on.
