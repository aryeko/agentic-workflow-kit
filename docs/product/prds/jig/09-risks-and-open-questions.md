← [Back to README](./README.md)

# Risks and open questions

## Assumptions

| Assumption | Evidence | Revisit when |
|---|---|---|
| The 10 AC prefix groups (FENCE/EARN/GUARD/DOOR/MERGE/CFG/RESUME/ISO/STACK/SEE) plus PLAN and SURF cover all ship-blocking product requirements without further decomposition | `jig.md` defines all five guarantee groups in full; PLAN and SURF were explicitly named as needed sub-areas in the product overview | A new guarantee emerges during technical design or red-team that has no coverage in these 12 groups |
| Phase 0 scopes all five guarantees at minimum viable level; Phase 1 expands driver breadth; Phase 2 hardens evaluation | `docs/product/status.md` phasing rationale and `jig.md` honest-edges sections | Technical design reveals a dependency that makes one guarantee impossible without another driver or a Phase 1 feature |
| The three canonical presets (_prevention_, _balanced_, _throughput_) are sufficient to cover the full product; additional presets are guidance, not requirements. _Prevention_ and _balanced_ are the Phase 0 scope (CFG-6); _throughput_ ships in Phase 1 (CFG-9) | `jig.md` CFG-5 names all three; CFG-6 and CFG-9 assign the Phase 0 / Phase 1 split | User research or design work surfaces a fourth distinct operating mode that cannot be approximated by tuning from one of the three, or Phase 0 acceptance requires the throughput preset |
| The Claude agent adapter is a Phase 1 target; Codex is the only Phase 0 agent driver | `jig.md` §④ honest edges explicitly names Codex as the current driver and Claude as the noted next | Phase 0 delivery requires the Claude adapter for a key design or test scenario |
| The fix-forward scan seam (CFG-7) is an enable-not-build seam; Jig wires the hook but does not ship the scan implementation | `jig.md` CFG-7 and ISO-2 both mark this as a seam, not a shipped feature | A Phase 0 throughput-leaning delivery loop requires the scan to be meaningful; currently assumed not needed until Phase 1 |
| Worker/runner isolation (MERGE-2, FENCE-3, STACK-5) is a system-enforced architectural invariant, not a configurable option | `jig.md` §①.5 and `docs/design/` invariants (AD-12) both state this; the non-negotiable invariants section of `AGENTS.md` lists it explicitly | A stakeholder or integrator requests worker-level merge authority — the answer is no, but the assumption is that no such request changes the requirement |
| The event log schema is the single shared source of truth; there is no separate audit log | `jig.md` SEE-3 states this explicitly | A compliance, regulatory, or integration requirement surfaces that demands a separate immutable audit log |
| Checkpoint granularity is at the story level (not per-instruction); resume re-runs from the last story boundary | `jig.md` ③ honest edges: "Resume granularity is the checkpoint, not the individual instruction" | A Phase 0 delivery scenario requires finer-grained checkpointing than story-level |
| A crash or unclean process exit is a resume trigger indistinguishable from a deliberate pause — Jig applies the same RESUME-1 through RESUME-5 guarantees either way | No product-level evidence distinguishes crash recovery from pause/resume in outcome; the guarantees are identical | A compliance requirement surfaces that demands different behavior or additional audit events for crash vs deliberate pause |
| The execution-plan schema is Jig's input contract; the fields and shape of that schema are technical design decisions, not PRD decisions | `README.md` and `jig.md` both state the schema is Jig's one hard boundary; PLAN-4 specifies the minimum required fields at PRD level | Technical design reveals that additional required-field decisions (beyond PLAN-4) have product-level implications and belong back in this PRD |
| MCP surface (SURF-3) is a Phase 1 target; CLI and skill are sufficient for Phase 0 | `jig.md` sub-modules list "delivery surfaces (skill / CLI / MCP)" without phasing; no prior evidence MCP is Phase 0 | A key Phase 0 integration scenario requires programmatic MCP access |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| The `docs/design/` corpus was authored before this PRD; some design decisions may have pre-empted product decisions | high | Phase 4 (design reconciliation) explicitly uses this PRD as the source of truth to diff against the design; discrepancies are reconciled in favor of the PRD |
| The execution-plan schema seam (PLAN-1 through PLAN-4) under-specifies the schema at PRD level — the technical design may interpret it more narrowly or broadly than intended | med | PRD-level PLAN-4 specifies minimum required fields; the technical solution is responsible for the full schema; the red-team gate (Phase 2) should verify PLAN-4 is not silently narrowed |
| The three-preset model (CFG-6) may prove insufficient once real users set up Jig and find the presets don't match their operating environment | med | Presets are documented as tunable starting points, not locked choices; the guided setup (CFG-5) can map non-standard intent to a custom configuration derived from a preset |
| Capability attestation probes (EARN-1/EARN-2) add latency to run startup; slow probes may cause user friction | med | Attestation results are cached per-run-start (not per-run); Phase 2 eval suite will include attestation latency measurements |
| Anti-gaming protection (GUARD-2) blocking legitimate workflow changes mid-run (e.g. a developer needs to update a CI step in the middle of a large run) | med | The re-approval path is defined (re-approve + re-verify); the UX of that path should be fast and non-blocking for the unaffected parts of the run; document this as a known operational pattern |
| The worker/runner split (MERGE-2) is the correct architecture but may be hard to enforce cleanly across all agent SDK integrations, which often expose push/merge as standard tool calls | high | FENCE-5 requires the authorization fence to cover all SDK paths including third-party tool calls; this is a known design challenge for the technical solution; flag for the technical design explicitly |
| Hidden cross-story dependencies not expressed in the plan invalidate ISO-1's fault isolation guarantee | med | ISO-1 scopes the guarantee to "the dependency graph as declared in the plan"; undeclared dependencies are a plan quality issue, not a Jig issue. The learning loop (a separate product) is the mechanism for hardening plans against undeclared dependencies. Document this honest edge explicitly. |
| Design reconciliation (Phase 4) may surface domain-level design decisions that conflict with product requirements added in this PRD (e.g. a design decision that pre-empted CFG-4 or changed RESUME semantics) | high | Phase 4 is specifically designed for this; the PRD is the source of truth, and the reconciliation uses `/red-team-prd` against the design. Flagged as high-severity because the design corpus is large. |

## Blocking questions

The following questions were raised during the pre-PR review. They are not blocking this PRD
from proceeding — each has a recorded safe assumption that allows technical design to move forward
— but they should be confirmed by the product owner before or during the red-team phase (Phase 2):

1. **Preset semantics at product level** — CFG-6 now records the policy-field defaults for
   _prevention_ and _balanced_ at PRD level. The PRD does not specify field-level values beyond
   the semantic labels. Safe assumption: exact field-level policy values are technical design
   decisions; the PRD specifies semantic intent. Revisit if technical design cannot uniquely
   derive a policy-field from the semantic label.

2. **Three-preset model Phase 0 scope** — CFG-6 now covers only _prevention_ and _balanced_ at
   Phase 0; _throughput_ is explicitly Phase 1 (CFG-9). Safe assumption: this is the correct
   phasing. Revisit if Phase 0 acceptance requires the throughput preset.

3. **Protected-file system-inferred category list** — GUARD-5 names the system-inferred set
   by example (CI config, policy file, gate setup, verification config). The exact membership
   of the system-inferred set is a technical design decision. Safe assumption: the technical
   solution enumerates the set; the PRD defines the semantic boundary. Revisit if the PRD
   needs to enumerate specific file paths or glob patterns.

## Open questions

- **How should the guided setup (CFG-5) handle users who want to configure below the preset
  level from the start?** — *Safe assumption: guided setup always offers a preset first;
  advanced configuration is accessible after preset selection. Revisit if user research shows
  strong preference for skipping the preset step.*

- **What is the versioning cadence for the execution-plan schema (PLAN-3)?** — *Safe
  assumption: semver with a documented migration path for major-version breaks; patch changes
  are backward-compatible. This is a technical design decision; the PRD requires only that a
  migration path exists.*

- **Should the _throughput_ preset ship with a reference fix-forward scan implementation
  (not just the seam), for users who want an out-of-the-box throughput experience?** —
  *Safe assumption: no — the fix-forward scan is explicitly an enable-not-build seam
  (CFG-7, ISO-2); shipping a reference implementation belongs in Phase 1 and is a separate
  product decision. Revisit if Phase 1 delivery planning surfaces this as blocking.*

- **What is the minimum viable event log schema at Phase 0 — specifically, which fields are
  required in every event?** — *Safe assumption: technical design decides the exact schema;
  PLAN-4 specifies the minimum required fields at the story/plan level; SEE-1 specifies the
  required event categories at the PRD level. Exact field definitions belong in the technical
  solution.*

- **Should the escalation grant (DOOR-3) be scoped to the specific command type or to the
  broader capability?** — *Safe assumption: the scoping is as tight as practicable for the
  situation; the exact granularity of the scoping is a technical design decision. DOOR-3
  requires "as tight as the situation allows" — the technical solution determines the
  granularity options.*

---
Previous: [08-acceptance-criteria](./08-acceptance-criteria.md) · Next: [10-glossary](./10-glossary.md) · Up: [README](./README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig PRD](./README.md) · **← Prev:** [Acceptance criteria](./08-acceptance-criteria.md) · **Next →:** [Glossary](./10-glossary.md)

<!-- /DOCS-NAV -->
