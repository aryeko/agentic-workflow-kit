# DRAFT — proposed "Frozen v1 Agent port" note for prov-01 README §5

> Proposed additive note. Architect-paste candidate. Verbatim from the current approved contract in
> `contracts-and-conformance.md` and README §5-§6; this is a **freeze of the existing surface**, not a
> redesign. Pairs with the decision in `../proposal.md` (freeze-current).

## Frozen v1 Agent port (core-03 / core-04 contract)

The v1 Agent contract surface below is **frozen**: core-03 (Approval & Escalation) and core-04
(Supervision & Liveness) are designed and approved against exactly these shapes. The provider-neutral
redesign under `docs/agent-provider-contract-researches/` is a **post-v1, non-breaking evolution behind
this same `AgentDriver` port**, not a v1 change.

**Methods (`AgentDriver`):** `probeCapabilities`, `startWorker`, `observe`, `answerApproval`,
`resumeOwned`, `stopObserving`.

**Event union (`AgentEvent`):** `linked`, `progress`, `approval-requested`, `tool-observed`,
`guardian-review`, `degraded`, `terminal`. At most one `linked`; exactly one `terminal`;
`tool-observed.exitCode` + `outputRef` required; stable `tool-observed.itemId` required for core-04's
per-tool timer.

**Capabilities (six):** `canRelayApproval`, `canPersistApprovalAnswerChannel`, `canResumeOwned`,
`emitsStructuredToolExit`, `emitsGuardianReview`, `preservesHostProcessParentage`.

**Failure tokens (ten):** `agent-capability-unattested`, `agent-linkage-lost`,
`approval-relay-unattested`, `approval-answer-channel-lost`, `agent-resume-unattested`,
`structured-tool-exit-missing`, `tool-output-ref-missing`, `guardian-review-untrusted`,
`host-parentage-unproven`, `agent-terminal-ambiguous`.

**`ScopedGrant` (imported by core-03):** `kind ∈ ScopedGrantKind` (`command-once`, `command-session`,
`command-policy-amendment`, `file-change-once`, `file-change-session`, `filesystem-permission`,
`network-permission`, `mcp-elicitation-content`, `tool-user-input-content`, `deny-continue`,
`deny-interrupt`, `deny-park`); `scope ∈ {"request","turn","session"}`; optional `command`,
`commandPrefix`, `filePaths`, `networkHost`, `networkAction`, `filesystemEntries`, `content`;
required `grantId`, `grantEventId`.

**Production-gated (negative at core-build, flip on real-Codex live probes):**
`preservesHostProcessParentage` (core-04 fails closed to `supervision-lost`; kill-dependent autonomy
off) and `canPersistApprovalAnswerChannel` (core-03 parks via `approval-answer-channel-lost`).
