---
title: D1 — Execution substrate & provisioning
status: draft
last-reviewed: 2026-06-18
part-of: autopilot-durability
themes: [A, B, C]
builds-on: [00-overview.md]
---

# D1 — Execution substrate & provisioning

Get a child that is **capable** (deps installable, worktree ready), **correctly-permissioned** (no silent
override shadowing), and able to **really request approval** when it needs elevated permission — with the
orchestrator **relaying decisions and supervising, never doing the child's work.**

Themes: **A** (provisioning / network), **B** (approval contract), **C** (override shadowing).
Builds on the [spine](00-overview.md): the bidirectional channel, capability gates, event-sourced state.

## 1. Principle — the child is the actor

The child runs the repo's setup, installs deps, verifies, and opens the PR **itself**. The orchestrator
provisions *context* (worktree, resolved profile, policy) and *relays approvals* + supervises. It never
runs the install/setup/push on the child's behalf. (Theme **K** — parent-does-the-work — is an explicit
anti-pattern, see §3.7.)

## 2. Provisioning contract (Theme A — setup)

Before launch the orchestrator prepares **context, not labor**:

- An isolated git worktree + branch (exists today).
- A single **resolved agent profile** (§4) and the run's **approval mode + escalation policy**.
- A **provisioning contract** injected into the child prompt: *"Step 0 — if the repo declares a
  fresh-worktree setup command (`provisioning.setupCommand`, e.g. `scripts/setup-worktree.sh`), run it
  before anything else; request escalation if it needs network/privilege."*

Config declares the repo's setup command and how to detect a fresh worktree, so the **child runs setup as
its first contracted step** (fixing pathway #10, "setup not run before `pnpm`") — and runs it itself,
consistent with §1.

## 3. The approval relay (Themes A + B) — the heart of D1

This is the mechanism that stalled both runs. It is now grounded in the [runtime findings](notes/codex-runtime-findings.md).

### 3.1 What actually broke

Codex raises an approval as a **server→client request** (v1: MCP `elicitation/create`; v2:
`item/commandExecution/requestApproval`, carrying `command`, `cwd`, `reason`, `networkApprovalContext
{host, protocol}`). The kit registered **only a notification handler** and advertised **no elicitation
capability**, so the request was dropped and the child's `callTool` hung until the runtime timeout →
`supervision_lost`. Under the default `approvalPolicy: never`, no request is raised at all → the network
op is silently sandbox-denied. Both failure modes are config- and handler-level, not fundamental.

### 3.2 The relay (protocol-agnostic logic)

The driver exposes an **approval-request channel** (D2 picks the concrete protocol). On every request the
runner:

1. **Catch** it — the driver answers the approval-request method; it is *never* dropped. *(This single
   change unblocks the stall.)*
2. **Normalize** to `ApprovalRequest { requestId, kind: network|exec|patch|fs, command?, cwd?, reason,
   host?, protocol? }`.
3. **Classify risk** → `low | medium | high` (deterministic rules, §3.4).
4. **Adjudicate** via the mode ladder (§3.3) → an `ApprovalDecision`.
5. **Return a scoped decision** — the *tightest* grant that suffices (§3.5).
6. **Record** request + decision + rationale as events (audit; feeds D5).
7. The child proceeds — or, on deny/park, §3.6.

### 3.3 Adjudication — modes + tiered ladder

Operator-selectable **mode** per run; `auto` adds the orchestrator as a third adjudicator:

```
request → policy allowlist match?            → grant (by: policy)
        → mode = auto & riskTier ≤ autoMax?   → orchestrator decides (by: orchestrator, + rationale)
        → else                                → park awaiting-approval → human (by: human)
```

| Mode | Behavior |
|---|---|
| `manual` | every escalation → human |
| `assisted` (default) | policy allowlist → else human |
| `auto` | policy allowlist → orchestrator-decide (risk-bounded) → else human |

Config: `approval: { mode: manual|assisted|auto, autoMaxRiskTier: low|medium }`. Orchestrator-decide is a
gated capability (`orchestrator-decide-approvals`, D0): it **must record a rationale + the evidence it
weighed**, is bounded by `autoMaxRiskTier`, and **high risk always escalates to a human** regardless of mode.

### 3.4 Risk classification

Deterministic, rule-based, inspectable; rules ship as built-ins + repo overrides. Indicative:

| Tier | Examples |
|---|---|
| **low** | network to a declared registry for a declared package manager; read-only inspection |
| **medium** | network to an undeclared host; post-install scripts; escalated writes inside the worktree |
| **high** | secret access; `danger-full-access`; writes outside the worktree; destructive/irreversible; arbitrary egress |

Each request's tier is recorded with the rule that matched.

### 3.5 Scoped grants (Theme A — grounded in the [runtime findings](notes/codex-runtime-findings.md))

Grant the **tightest** scope that works, keeping the sandbox otherwise `workspace-write`/no-network:

1. **per-command** (`accept`/`approved`) — one-shot escalation for just this exec;
2. **per-host network amendment** (`network_policy_amendment {host, allow}`) — for repeated fetches to a
   known host (e.g. `registry.npmjs.org`);
3. **session scope** only when necessary; **never** blanket `danger-full-access` via the relay.

The **default `escalationPolicy` pre-approves standard dependency install** as a per-host network grant to
declared registries for declared package managers — so `pnpm install` auto-grants (`by: policy`, audited)
with no human or orchestrator in the loop. Off-policy network and privileged ops still escalate.

### 3.6 Park & resume — the `awaiting-approval` state

When a request needs a human (`manual`, out-of-bounds in `auto`, or the orchestrator defers):

- The run **parks** in a recoverable `awaiting-approval` state. The child's turn is **suspended, not
  killed**; the request is surfaced to the operator; the supervisor is released (no busy-wait — it uses the
  D0/D5 subscription wake).
- On the human decision, the relay returns the **scoped** decision and the child **resumes the same turn**.
- The relay **time-boxes its own decision** so the child never hangs forever; on timeout it parks (or denies
  per policy). (Codex's decision enum includes `timed_out`.)

Park/resume is the approval use of the same bidirectional channel D2 owns; it is why D1 and D2 are
co-designed.

### 3.7 "Never do the child's work" (Theme K guardrail)

The relay grants **permission**; the child performs the action. The orchestrator must not execute
install/setup/push itself. If a grant **cannot be delivered** (un-owned session, runtime can't relay), the
run **parks recoverable** — it does **not** fall back to the parent doing the work. Safety + recoverability
over silent substitution.

## 4. Deterministic profile resolution (Theme C)

**The bug:** `profile?.x ?? childSession.x` (`toolInput.ts:37-38`) lets the profile shadow an operator
override — so `run_story { sandbox: 'danger-full-access' }` silently did nothing.

**The fix:** one ordered resolution, documented and tested, producing a single `ResolvedAgentProfile`
consumed everywhere downstream (no re-reading profile-vs-childSession later):

```
precedence (highest → lowest):
  explicit per-run operator override (run_story/run_eligible args)
    > agent profile
      > childSession defaults
        > built-in defaults
```

**Operator overrides win** — that is the entire point of an override. The resolved profile is **recorded as
an event with per-field provenance** (which layer set `sandbox`, `approvalPolicy`, etc.), so shadowing
becomes impossible *and* inspectable. Resolved fields: model, reasoning, sandbox, `approvalPolicy`, prompt,
structuredOutput, budget, `escalationPolicy`, approval `mode`.

**Default `approvalPolicy` is `on-request`, not `never`** — under `never` no approval request is ever raised,
so the relay has nothing to answer and network work is silently denied (per the runtime findings). Children that may
need network must run `on-request` (or `untrusted`).

## 5. Capability ties (defined in D0, evaluated here)

`escalation-auto-grant` (policy tier) · `orchestrator-decide-approvals` (`auto`, risk-bounded) ·
`unattended-run` (all needed escalations are policy-covered or orchestrator-decidable in bounds).

## 6. Open questions

- **Concrete approval protocol** (v1 `elicitation/create` handler vs v2 `app-server` typed requests):
  decided in **D2**, since it is coupled to process ownership + control. D1's relay logic is unaffected.
- Exact built-in **risk-classification ruleset** and the `escalationPolicy` schema (host patterns, command
  prefixes, package managers).
- Fresh-worktree **detection** and the `provisioning.setupCommand` config shape.

## 7. Testability

- **Relay** is a pure function `(ApprovalRequest, policy, mode, riskRules) → ApprovalDecision` → exhaustive
  table tests (mode × tier × policy-match → expected `by` + `scope`).
- **Risk classifier** is pure → table-driven tests, including the high-always-to-human invariant.
- **Profile resolution** is a pure precedence function → assert operator override wins; assert provenance.
- **Park/resume** against a **fake driver**: emit an approval request, assert the park event, inject a
  decision, assert resume + the scoped grant returned.
- **Provisioning** integration test: a fake repo that needs install; assert the child runs `setupCommand`
  first and that `pnpm install` auto-grants via default policy.

## Themes addressed

| Theme | Resolution |
|---|---|
| A | Child installs itself via scoped escalation; setup is a contracted child step; default policy pre-approves install (per-host, audited) |
| B | Approval requests are caught, risk-classified, adjudicated (modes/tiers), and answered with a scoped grant — never dropped; `never` default removed |
| C | Deterministic precedence (operator override wins); resolved profile recorded with per-field provenance |
