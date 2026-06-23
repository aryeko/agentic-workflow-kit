# plan-epic Stage Contract

Use this reference after `SKILL.md` activates. Read only the live source files needed for the named epic; do not load the whole corpus.

## Source Docs To Read

Before authoring, read:

- `AGENTS.md`
- `docs/implementation-authoring/delivery-pipeline/README.md`
- `docs/implementation-authoring/delivery-pipeline/10-pipeline-and-invariants.md`
- `docs/implementation-authoring/delivery-pipeline/20-plan-epic.md`
- `docs/implementation-authoring/authoring-standard/README.md`
- `docs/implementation-authoring/authoring-standard/40-story-dag.md`
- `docs/implementation-authoring/authoring-standard/50-story-contract.md`
- `docs/implementation-authoring/authoring-standard/60-coverage.md`
- `docs/implementation-authoring/operating-model/architect.md`
- `docs/implementation-authoring/operating-model/characterization-review.md`
- The target epic charter under `docs/implementation/epics/`
- Every included domain charter and frozen design seam cited by that epic

## Input Gate

`plan-epic` starts only when all are true:

- One named epic resolves to one charter under `docs/implementation/epics/`.
- The charter status is `epic: ready`.
- Included domains and cited design seams are frozen.
- The checkout is the user-requested workflow-kit worktree.
- Existing DAG/story files are absent, placeholders, or explicitly safe to fill without overwriting non-placeholder work.

## Output Gate

Done means all are true:

- The story DAG status is `story-dag: frozen`.
- Every selected story contract is `story: ready`.
- Characterization review evidence exists for each ready story.
- Every owned Story Group Signal maps exactly once to a story id or named `split`.
- The target epic charter README, not the global coverage rollup, has the owning-story cells backfilled.
- No design requirements were invented, and every AC traces to frozen design.
- No execution package, dispatch prompt, feature code, or delivery run was created.

## DAG gates (Gate 3) — structure and seams

Run this seam pass **before** sizing nodes; node boundaries fall out of it, not the other way round.

**Value-type vs runtime-object seam.** For each shared shape, decide how its consumers use it:

- *Value type* — a data shape passed as a function input (built from fixtures in tests).
- *Runtime object* — a live instance whose methods the consumer calls.

Declare every value type in a single **type-only contract story** and point consumers at that story. A
type and the behavior that produces its values may live in different stories; a consumer that needs only
the *type* depends on the contract story, never on the *behavior* story. Gate 3 fails if any cross-story
(especially cross-domain) edge targets a producer's behavior story while the consumer uses only that
producer's value types — re-point the edge at the type-only contract story. (Symptom of getting this
wrong: a deep, narrow band chain where each behavior gates the next; the value-type seam should yield
wide bands.)

**Single producer, no collapse.** Each shared shape has exactly one producer. A type-only contract
surface that a later epic will extend, or that more than one story consumes, is its **own** story — never
merged into an executable, smoke, or behavior story that consumes it. Collapsing a contract producer into
its consumer destroys the stable seam later epics extend.

**Cross-epic forward-reference (sequencing).** Every field type a story declares must resolve to **this
epic or an already-frozen earlier epic/domain**. If a declared interface references a type owned by a
*later* epic:

- declare only the self-contained subset whose fields all resolve now;
- name the deferred remainder and the later epic that owns it;
- if the surface genuinely cannot be declared without the later-epic type, **STOP and escalate a
  design-sequencing gap** — never forward-reference or invent the missing type.

Naming a later-epic-owned interface as an owned spec-surface type is a Gate 3 failure.

**Pathset convention.** Owned pathsets follow the design's layer grouping and domain slug (derive from the
design domain directory and the prior frozen DAGs, e.g. Epic 1). Reject a pathset that places a domain's
code outside its design layer (a top-level module instead of under the layer directory) or invents a
directory not traceable to the design package decomposition.

## Contract gates (Gates 4-6) — AC depth

- Every AC is enumerated and falsifiable, with an evidence clause that names **more than a bare test-file
  path**: an exact value/equality assertion, an exhaustiveness (`never`) switch, a named negative fixture,
  or a runnable sweep (path + forbidden token + expected exit). An AC whose only evidence is "see test
  file X" fails Gate 4.
- Each failure/degraded/validation token maps to exactly one owning AC; the failure table cites that AC.
- Public-exposure AC + import path + public-import test for every exported shape.
- A numeric per-file size budget within the repo cap (200–400 typical, 800 hard).
- Runnable sweeps for forbidden symbols and re-exports.

## Characterization Review

Review the authored DAG and contracts before setting readiness:

- Gate 3 for the DAG, **including the seam pass above**: value-type seam, single-producer / no-collapse,
  cross-epic forward-reference, pathset convention.
- Gates 4-6 for every story contract, including AC depth above.
- Record each **load-bearing scope decision** (node boundaries, single-producer hoists, value-type seams,
  cross-epic deferrals) as a named entry carrying: the rationale, the design line it traces to, the
  falsification criterion, and the escalation path if violated. A bare `[x]` checklist or a post-hoc
  "all checks passed" summary does **not** satisfy the gate — readiness set on an unevidenced self-check
  is a defect.
- Findings quote the source design line or AC they contradict.
- Findings classify `story-defect` or `design-defect`.
- The architect owns the final verdict; a spec-reviewer assists only.

## Escalation

Stop and report blockers with exact file and line evidence for:

- Missing or ambiguous requirements.
- Non-frozen inputs.
- Inconsistent source artifacts.
- Existing non-placeholder work that would be overwritten.
- Any request to expand the stage into package creation, dispatch, implementation, or design editing.
