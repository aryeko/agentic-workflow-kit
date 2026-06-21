# T2 — Decide the Agent-port disposition (prov-01)

**Type:** DECISION (recommendation, not fiat).
**Owner of the corpus this touches:** prov-01 Agent Execution + consumers core-03, core-04.
**Status of this document:** recommendation for an architect ruling. No corpus file is edited.

---

## Decision / answer

**Recommendation: FREEZE the current v1 surface and treat the "smallest-useful, provider-neutral"
redesign as a post-v1 evolution behind the unchanged port.**

The current v1 Agent contract (`probeCapabilities` / `startWorker` / `observe` / `answerApproval` /
`resumeOwned` / `stopObserving`, the seven-arm `AgentEvent` union, the six named capabilities, the ten
failure tokens, and the `ScopedGrant` shape) is **already the frozen contract that core-03 and core-04
were designed and approved against**, and it is sufficient for both consumers. The redesign research is
a legitimate future improvement but is not ready to finalize and is not needed to unblock core.

### Rationale (a): tied to core-03 / core-04 needs

- **core-03 imports the v1 grant vocabulary by exact value and would be broken by the redesign.**
  `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` (lines ~18-23,
  "// Import ScopedGrant and ScopedGrantKind from prov-01 Agent Execution"; "// ScopedGrant.scope is
  `request` | `turn` | `session`") and its grant-mapping table (lines ~168-179) hard-map core-03's
  `PolicyGrantScope` (`per-command` / `per-command-prefix` / `per-host` / `session`) onto exact prov-01
  `ScopedGrantKind` values (`command-once`, `command-policy-amendment`, `network-permission`,
  `file-change-session`, `deny-park`) and exact `ScopedGrant.scope` values. The redesign research
  proposes a different grant/request model (a single normalized `AgentRequest` union, evidence-based
  `CapabilityClaim`s, removal of provider-shaped vocabulary — see the research digest in
  `docs/agent-provider-contract-researches/gpt55thinking.md` §"Minimal contract surface" /
  §"Core concepts", and the parallel sections in `gemini31pro.md` and `gemini35flash.md`). Adopting it
  now would invalidate core-03's already-approved mapping table.

- **core-04 consumes the v1 `AgentEvent` union and `AgentToolObserved.itemId` by name.**
  `docs/design/30-domain-reference/core/supervision-and-liveness/README.md` §4-§5 folds liveness over
  the v1 event classes (linkage / progress / structured tool completion / approval request / terminal),
  consumes `agentEvents: AsyncIterable<AgentEvent>` (§5 `SupervisionInputs`), and keys its per-tool timer
  off `AgentToolObserved.itemId` (§10 "Resolved for v1"). The redesign strips tool-specific events from
  the core vocabulary (research digest: all three docs replace `tool-observed`/`emitsStructuredToolExit`
  with a neutral surfaced-request/`AgentRequest` model), which would force a core-04 redesign.

- **Both consumers are already `status: approved`.** prov-01 README is `status: approved`
  (`docs/design/30-domain-reference/providers/agent-execution/README.md` front-matter), core-03 README is
  `status: approved`, and core-04 README is `status: approved`. The implementation critical path
  (core-03, core-04) needs a *frozen* surface to code against; freezing the surface already in those
  designs is the zero-rework path.

### Rationale (b): tied to schedule / risk

- **The redesign is not internally settled.** The three research docs **disagree on the core delivery
  model** (request-response `observe(ObservationRequest)` in `gemini31pro.md` vs streaming-only
  `observe(): AsyncIterable` in `gemini35flash.md` vs hybrid mandatory-`readEvents` + optional
  `subscribeEvents` in `gpt55thinking.md`), on **stop semantics** (`requestStop` vs generic
  `signalControl`), and on **ownership representation** (runtime enum vs type-forced handle classes).
  Finalizing now means picking a winner among unreconciled proposals on the implementation critical
  path — schedule risk with no consumer-driven need.

- **The two real-Codex gaps are evidence gaps, not contract-shape gaps.** The unproven items
  (`preservesHostProcessParentage`, `canPersistApprovalAnswerChannel`) are already modeled in v1 as
  capabilities that **fail closed when unattested** (see Production-gated section below). They do not
  require a contract redesign to be handled safely; the redesign does not close them either (the research
  digest shows all three docs *defer* parentage to the Execution Host and answer-channel persistence to a
  separate storage concern — i.e. they would also leave these unproven at core-build time).

- **The redesign's good ideas are non-breaking and can land later behind the same port.** Evidence-grade
  capability claims, paginated/bounded event reads, and neutralized request vocabulary can be introduced
  as a v2 of the same `AgentDriver` interface (the seam is owned by the SDK per
  `docs/design/10-architecture/provider-seams.md` "Boundary rule"), without blocking core now.

### Rejected alternative: FINALIZE the smallest-useful redesign now

Rejected because: (1) it breaks the already-approved core-03 grant-mapping table and core-04 event/tool
model, forcing re-review of two core domains on the critical path; (2) the three research inputs are not
reconciled with each other on delivery model, stop semantics, and ownership, so "finalize now" means
making three unforced architectural picks under schedule pressure; (3) it yields no capability the
consumers need that v1 lacks — core-03 and core-04 are fully expressible on the v1 surface today; and
(4) it does not close the two real-Codex evidence gaps, so it buys redesign cost without buying the
production readiness those gaps are about. The research's own "finalize now" stance is argued from
design-elegance, not from a consumer or schedule constraint, and is therefore out of scope for the
implementation-unblocking decision this task owns.

---

## Frozen port surface (the contract core depends on)

Frozen as-is from
`docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md` and
`README.md` §5-§6. Core-03 and core-04 code against exactly this.

### Methods — `AgentDriver`
- `probeCapabilities(scope: AgentProbeScope): CapabilityAttestation[]`
- `startWorker(request: AgentStartRequest): AgentSession | AgentFailure`
- `observe(session: AgentSession): AsyncIterable<AgentEvent>`
- `answerApproval(session: AgentSession, answer: ApprovalAnswer): ApprovalAnswerResult`
- `resumeOwned(request: AgentResumeRequest): AgentSession | AgentFailure`
- `stopObserving(session: AgentSession): AgentReleaseResult`

### Event union — `AgentEvent`
`linked` · `progress` · `approval-requested` · `tool-observed` (`ToolObserved{command, exitCode,
outputRef}`) · `guardian-review` · `degraded` · `terminal`.
Invariants (frozen, from `capabilities-and-conformance.md` §"Event invariants"): at most one `linked`,
exactly one `terminal`; `tool-observed.exitCode` and `tool-observed.outputRef` required (else
`structured-tool-exit-missing` / `tool-output-ref-missing`); stable `tool-observed.itemId` required for
core-04's per-tool timer (else core-04 degrades to `tool-tracking-unavailable`).
Log-event mapping is frozen too (`linked → AgentSessionLinked`, … `terminal → AgentSessionTerminal`;
README §6).

### Capability vocabulary (six)
`canRelayApproval` · `canPersistApprovalAnswerChannel` · `canResumeOwned` · `emitsStructuredToolExit` ·
`emitsGuardianReview` · `preservesHostProcessParentage`. Gates require fresh, positive, in-scope
attestations; stale/absent/negative/schema-only evidence disables the dependent power
(`capability-attestation.md` "Evaluation rules").

### Failure tokens (ten) — `AgentFailureReason`
`agent-capability-unattested` · `agent-linkage-lost` · `approval-relay-unattested` ·
`approval-answer-channel-lost` · `agent-resume-unattested` · `structured-tool-exit-missing` ·
`tool-output-ref-missing` · `guardian-review-untrusted` · `host-parentage-unproven` ·
`agent-terminal-ambiguous`. (README §8 enumerates the same set with degraded-mode semantics.)

### `ScopedGrant` shape (frozen — the exact shape core-03 imports)
```ts
type ScopedGrantKind =
  | "command-once" | "command-session" | "command-policy-amendment"
  | "file-change-once" | "file-change-session" | "filesystem-permission"
  | "network-permission" | "mcp-elicitation-content" | "tool-user-input-content"
  | "deny-continue" | "deny-interrupt" | "deny-park";

interface ScopedGrant {
  grantId: string;
  kind: ScopedGrantKind;
  scope: "request" | "turn" | "session";
  command?: string;
  commandPrefix?: string[];
  filePaths?: string[];
  networkHost?: string;
  networkAction?: "allow" | "deny";
  filesystemEntries?: unknown[];
  content?: unknown;
  grantEventId: string;
}
```
core-03's grant-mapping table (`decision-model.md` §~168-179) depends on these exact `kind` and `scope`
values; freezing them is what keeps core-03 valid. (A copy of the frozen surface is in
`draft/frozen-port-surface.md` for convenience.)

---

## Production-gated capabilities (absent at core-build time)

Two capabilities have **schema-only evidence** for the pinned Codex version and are therefore **negative
/ unattested at core-build time**. Evidence:
`docs/design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md`
§"Conformance suite" ("Current evidence … satisfies schema and MCP tools-list probes for Codex 0.141.0,
but does not satisfy the live-driver smoke, approval persistence, structured tool-exit, or parentage
probes"); `codex-driver.md` §"Phase 0", §"Process parentage with prov-04"; README §10 open questions;
README §11 DoD (the one unchecked box: live approval/resume/tool-exit/parentage probes not complete).

| Capability | Production-gated because | Core degraded / park path that covers absence |
|---|---|---|
| `preservesHostProcessParentage` | Requires a joint prov-01/prov-04 live probe tying worker commands to the host-owned `containmentRef`; only schema evidence exists (`codex-driver.md` §"Process parentage with prov-04"; README §10). | **core-04** fails closed: `host-parentage-unproven` / `termination-unavailable` → liveness state `supervision-lost`, and capability gates treat kill-dependent autonomy and auto-recovery as **off** (supervision-and-liveness README §8; capabilities-and-conformance §"Capability set" — "Kill-dependent autonomy and recovery remain off"). Idle / no-progress / max-runtime timers stay active. |
| `canPersistApprovalAnswerChannel` | Requires a live probe that a pending approval survives disconnect/resume; Phase 0/Phase 1 evidence is schema-only (`codex-driver.md` §"Phase 0", §"Approval decision mapping" — persistence "is not inferred from JSON-RPC request ids"). | **core-03** parks: a captured-but-unanswerable request → `approval-answer-channel-lost`; the durable park/resume state machine holds pending state and resumes via the owned session when persistence is later attested (approval-and-escalation README §4, §8; prov-01 README §4 "the run parks rather than pretending an answer can be delivered later"; capabilities-and-conformance §"Event invariants" — live-only channel ⇒ run parks). |

Both are honest-degrade-by-design: the v1 contract already encodes "absent ⇒ park / fail closed," so
core can be built and tested against the mock with these capabilities **negative**, and they flip to
positive only when real-Codex live probes are captured (production gate), with **no contract change**.

---

## Status-mismatch resolution (AC4)

**Observed mismatch.** The prov-01 README is `status: approved`
(`providers/agent-execution/README.md` front-matter, line 5), but all four subfiles are `status: draft`:
`contracts-and-conformance.md` (line 3), `capabilities-and-conformance.md` (line 3), `codex-driver.md`
(line 4), `mock-driver.md` (line ~3, `status: draft` in front-matter). The contract that core-03/core-04
actually import (the typed `ScopedGrant`, the `AgentEvent` union, the failure tokens) lives in the
**draft** subfiles, so the domain advertises an approved contract whose normative type detail is still
marked draft.

**Proposed resolution (recommend to architect):** promote the **contract-bearing** subfiles to match the
approved README, and keep the **evidence-bearing** subfile honest:

- `contracts-and-conformance.md` → `status: approved`. It is the typed contract core imports; freezing
  this surface (this decision) makes "approved" correct.
- `capabilities-and-conformance.md` → `status: approved`. The capability set, event invariants, and
  conformance suite are the frozen vocabulary core gates on.
- `mock-driver.md` → `status: approved`. The mock is the conformance fixture core tests run against; its
  interface is the frozen contract.
- `codex-driver.md` → **keep `status: draft`** (or `provisional`), because its real-Codex live mappings
  are explicitly unproven (the two production-gated capabilities above). Promoting it would misrepresent
  the open live-probe evidence. Recommend an explicit note in its front-matter that the *schema* mappings
  are settled but *live* mappings await probes.

Rationale: the README's `approved` status is correct for the **contract**; the only honest-draft content
is the **real-Codex evidence** in `codex-driver.md`. Aligning the three contract subfiles to `approved`
removes the mismatch without overstating the live-driver readiness.

---

## Corpus impact — `docs/**` files + sections to change (no file edited here)

These are the amendments an architect would apply **after** accepting this decision. Paths only; nothing
edited by this task.

1. `docs/design/30-domain-reference/providers/agent-execution/README.md`
   - §10 "Open questions" / §11 "Definition of done": add a one-line note that the **v1 contract surface
     is frozen for core-03/core-04**, and that the provider-neutral redesign
     (`docs/agent-provider-contract-researches/`) is a **post-v1, non-breaking evolution behind the
     unchanged port** (not a v1 change). This reconnects the redesign to the roadmap without reopening v1.
2. `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md`
   - Front-matter `status: draft → approved` (status-mismatch resolution).
3. `docs/design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md`
   - Front-matter `status: draft → approved` (status-mismatch resolution).
4. `docs/design/30-domain-reference/providers/agent-execution/mock-driver.md`
   - Front-matter `status: draft → approved` (status-mismatch resolution).
5. `docs/design/30-domain-reference/providers/agent-execution/codex-driver.md`
   - Front-matter: **keep `draft`** (or set `provisional`); add a note that schema mappings are settled
     but the two live-probe capabilities (`preservesHostProcessParentage`,
     `canPersistApprovalAnswerChannel`) are production-gated.
6. *(Optional, no content change)* `docs/design/10-architecture/provider-seams.md` §"The four seams" and
   `docs/design/10-architecture/capability-attestation.md` §"Capability examples by provider" already
   describe the v1 Agent capabilities; if the redesign is later scheduled, add a forward-reference there.
   No change required for this decision.

Optional draft included: `draft/frozen-port-surface.md` (a copy-ready "Frozen v1 Agent port" section the
architect can paste under prov-01 README §5, verbatim from the current contract — additive, not a
redesign).

---

## Acceptance criteria — restated with where/how met

1. **Clear recommendation with rationale (a) core-03/04 + (b) schedule/risk, rejected alternative
   stated.** — MET. "Decision / answer": recommend **freeze-current**; rationale (a) cites core-03's
   grant-mapping import and core-04's event/`itemId` consumption (both already `approved`), rationale (b)
   cites the unreconciled research delivery-model/stop/ownership disagreements and that the redesign does
   not close the evidence gaps; rejected alternative (finalize-redesign-now) stated with four reasons.
2. **Frozen port surface listed: methods, event union, capability vocab, failure tokens, `ScopedGrant`
   shape.** — MET. "Frozen port surface" section enumerates all five, sourced from
   `contracts-and-conformance.md` and README §5-§6; `ScopedGrant` reproduced verbatim.
3. **The two real-Codex caps marked production-gated (absent at core-build), with the core degraded/park
   paths covering their absence.** — MET. "Production-gated capabilities" table marks both negative at
   core-build (schema-only evidence per `capabilities-and-conformance.md` §"Conformance suite") and maps
   each to its core fail-closed/park path (core-04 `supervision-lost`; core-03 park via
   `approval-answer-channel-lost`).
4. **Subfile status mismatch noted with proposed resolution.** — MET. "Status-mismatch resolution"
   documents README `approved` vs four subfiles `draft` (with line cites) and proposes promoting the
   three contract subfiles to `approved` while keeping `codex-driver.md` draft (live evidence open).
5. **Lists `docs/**` files+sections to change; no corpus file edited.** — MET. "Corpus impact" lists five
   files with sections plus two optional. `git status` confirms zero `docs/` changes (see report).

---

## Open issues / assumptions / risk

- **Assumption (consumer status):** I read core-03 README, core-04 README, and core-03
  `decision-model.md` as the authoritative consumer contracts. If a later, unreviewed core draft already
  depends on the redesigned surface, that would change the calculus; none was found under
  `docs/design/30-domain-reference/core/` (grep for `ScopedGrant` / `AgentToolObserved` returns only
  core-03 and core-04, both v1-shaped).
- **Architect ruling needed (status promotion):** the subfile `draft → approved` promotion is a status
  edit on owned corpus files; recommended here but must be applied by the prov-01 owner (Codex), not by
  this task.
- **Risk (deferred redesign drift):** freezing v1 risks the redesign research going stale. Mitigation:
  the corpus-impact note (#1) records the redesign as a scheduled post-v1 evolution behind the unchanged
  port, so it stays on the roadmap rather than being silently dropped.
- **Risk (production gate timing):** core can be fully built and tested on the mock with the two
  production-gated capabilities negative, but **unattended autonomy / kill-dependent recovery stays off**
  until the joint prov-01/prov-04 live probes land. That is the intended v1 posture (honest degrade), not
  a blocker for core-03/core-04 implementation.
