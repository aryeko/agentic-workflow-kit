# R11 - Config, Policy, and Migration

## Executive Recommendation

Expose vNext as an additive, versioned policy surface with explicit opt-in autonomous capabilities, deterministic profile resolution, and runtime capability probes. Confidence: high for the migration and default policy shape; medium for exact field names until R1/R3 finalize the Codex approval/control protocol.

## Sources Checked

- `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18, research charter and required report format.
- `docs/autopilot-durability/README.md`, checked 2026-06-18, incident context, v0.7.0 failure themes, and design constraints.
- `docs/autopilot-durability/design/00-overview.md`, checked 2026-06-18, draft capability-gating, event-sourcing, vNext contracts, and migration notes.
- `docs/autopilot-durability/design/01-execution-substrate-and-provisioning.md`, checked 2026-06-18, draft approval modes, escalation policy, risk tiers, scoped grants, and precedence rule.
- `docs/autopilot-durability/design/notes/codex-runtime-findings.md`, checked 2026-06-18, version-sensitive Codex 0.139.0 approval/control evidence.
- `packages/orchestrator/src/config/schema.ts`, checked 2026-06-18, current Zod config schema, defaults, profile defaults, and strict validation.
- `packages/orchestrator/src/config/configLoader.ts`, checked 2026-06-18, current resolved config and override merge behavior.
- `packages/orchestrator/src/config/version.ts`, checked 2026-06-18, current compatibility classification and explicit upgrade behavior.
- `packages/orchestrator/src/runtime/version.ts`, checked 2026-06-18, package/API/config version constants.
- `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`, checked 2026-06-18, current profile-before-childSession launch-policy precedence.
- `references/config-schema.md` and `references/config.schema.json`, checked 2026-06-18, human and machine config schema contract.
- `docs/prds/agentic-workflow-kit-redesign/runtime-versioning-design.md`, checked 2026-06-18, approved runtime/config versioning design.
- `presets/push-only.yaml` and `presets/push-and-merge.yaml`, checked 2026-06-18, current 0.7.0-style fully populated presets.
- Semantic Versioning 2.0.0, https://semver.org/, checked 2026-06-18, version semantics for compatible additions and breaking changes.
- Kubernetes API and deprecation docs, https://kubernetes.io/docs/concepts/overview/kubernetes-api/ and https://kubernetes.io/docs/reference/using-api/deprecation-policy/, checked 2026-06-18, standard pattern for additive fields, deprecation windows, and warnings.
- OpenFeature Flag Evaluation API, https://openfeature.dev/specification/sections/flag-evaluation/, checked 2026-06-18, feature-flag default-value and non-throwing evaluation behavior.
- JSON Schema Draft 2020-12, https://json-schema.org/draft/2020-12, checked 2026-06-18, current schema dialect used by `references/config.schema.json`.

## Findings

Facts:

- The current package is `agentic-workflow-kit` version `0.7.0`, while the current config schema version is `"0.6.0"` with minimum supported `"0.6.0"`.
- Current config compatibility already has a useful model: `current`, `legacy-upgradeable`, `supported-stale`, `unsupported-old`, `unsupported-new`, `invalid`, and `missing`. Upgrade writes are explicit, previewable, and currently only rewrite legacy `version: 1` to `"0.6.0"`.
- Current presets are fully populated and strict-schema validated. `push-only` defaults `pr.merge.auto: false`; `push-and-merge` opts into `pr.merge.auto: true`.
- Current default `storyImplementer` profile sets `approvalPolicy: never` and `sandbox: workspace-write`, with `structuredOutput.required: true`. That default is conservative for permission prompts but incompatible with the vNext approval-relay design because no approval request can be raised under `never`.
- Current launch input resolves `approvalPolicy` and `sandbox` as `profile value ?? childSession value`, so per-run overrides that land in `childSession` can be shadowed by profile values.
- The approved runtime-versioning design already says stale supported configs may warn, unsupported old/new configs must fail closed for config-dependent runtime actions, and upgrade prompts need CLI/MCP fallbacks rather than hidden auto-upgrade.
- The durability design proposes new config blocks: `approval`, `escalationPolicy`, `capabilities`, and `provisioning`, plus resolved profile provenance and capability gate records.
- The draft capability set includes `escalation-auto-grant`, `orchestrator-decide-approvals`, `auto-merge`, `auto-recover` / `auto-relaunch`, and `unattended-run`.
- Codex runtime evidence says approval/control behavior is version-sensitive. Some capabilities require runtime probes, not static config assumptions.
- External versioning patterns align with this: additive fields are generally safe, removals or behavior changes require a deprecation policy, flags should return defaults on abnormal evaluation, and version numbers should communicate compatibility.

Interpretation:

- vNext should not make `pr.merge.auto: true`, unattended operation, auto-recovery, or orchestrator-decided approvals appear in an existing repo merely because the runtime upgraded.
- vNext should fix the impossible default for dependency setup, but narrowly: make approval requests possible and policy-scoped, not broad full-access.
- The biggest compatibility risk is not schema parsing. It is semantic drift: a previously valid config might run with new powers or different override precedence unless the resolved policy is explicit, auditable, and reported before launch.

## Options

### Option A - Pure Additive Defaults, Runtime Gates Only

Add `approval`, `escalationPolicy`, `capabilities`, and `provisioning` with safe defaults, keep current config version compatibility broad, and rely on capability gates at run time to prevent unsafe behavior.

Enables:

- Minimal config churn for existing repos.
- Existing `.workflow/config.yaml` files keep parsing with expanded defaults.
- Capability checks can deny unsafe operations without requiring a migration first.

Cannot do:

- Make behavior changes obvious in review because defaults are implicit.
- Prevent confusion when a repo "supports" new fields but has never made an explicit vNext policy choice.
- Give operators a clean before/after migration artifact.

### Option B - Explicit vNext Policy Migration, Safe Defaults, Gate All Autonomy

Bump config schema when vNext policy fields land, add a previewable migration from `"0.6.0"` to the new schema, and write explicit safe policy blocks. Existing configs remain supported-stale or legacy-upgradeable during a transition, but mutating autopilot actions warn or block according to migration metadata.

Enables:

- Reviewer-visible policy for approvals, escalation, provisioning, and autonomy.
- A clear migration path from current 0.7.0 config and artifacts.
- Safe default behavior: vNext can enable dependency approval relay while keeping autonomous powers off until both config and runtime gates pass.
- Deterministic downgrade UX when runtime probes fail.

Cannot do:

- Avoid a schema bump and doc/test/preset updates.
- Finalize every capability field until R1/R3/R5/R7/R9 settle exact runtime and event contracts.

### Option C - Profile-First vNext, No Top-Level Capability Block

Expose most vNext behavior through `agents.profiles.*` and `childSession`, using profile names for "manual", "assisted", "auto", and merge behavior.

Enables:

- Reuses the current agent profile system.
- Lets advanced users construct specialized behavior per task type.

Cannot do:

- Cleanly express cross-cutting powers such as `auto-merge`, `auto-recover`, or `unattended-run`.
- Avoid the existing shadowing class of bugs unless profile resolution is redesigned anyway.
- Provide a simple operator UX for "what autonomous powers can this repo exercise?"

## Recommendation

Adopt Option B.

Recommended vNext config shape:

```yaml
version: "<next-config-version>"

provisioning:
  setupCommand: null
  freshWorktreeCheck: auto
  packageManagers:
    - name: pnpm
      installCommand: pnpm install --frozen-lockfile
      registries:
        - registry.npmjs.org

approval:
  mode: assisted
  autoMaxRiskTier: low
  humanTimeoutMinutes: 60

escalationPolicy:
  dependencyInstall:
    autoGrant: true
    packageManagers: declared
    registryHosts: declared
    lifecycleScripts: escalate
  network:
    default: escalate
    allowHosts: []
  filesystem:
    outsideWorktree: deny
  secrets:
    default: deny

capabilities:
  escalationAutoGrant: true
  orchestratorDecideApprovals: false
  unattendedRun: false
  autoRecover: false
  autoRelaunch: false
  autoMerge: false
```

Recommended semantics:

- Treat config fields as intent, not authority. A capability is allowed only when config enables it and runtime probes/evidence gates pass.
- Make `approval.mode: assisted` the default. Policy-matching low-risk dependency install can proceed; everything else parks for a human.
- Make `approvalPolicy: on-request` the effective child default for vNext story implementation only when the driver can catch and answer approval requests. If the driver cannot, downgrade to a parked/blocking state before launch rather than silently using `never`.
- Keep all irreversible or high-autonomy powers default-off: `autoMerge`, `autoRecover`, `autoRelaunch`, `unattendedRun`, and `orchestratorDecideApprovals`.
- Separate permission policy from PR policy. Existing `pr.merge.auto: true` should continue to mean "repo policy permits auto-merge", but vNext `capabilities.autoMerge` and runtime gates must also allow it before the runner merges.
- Change resolved profile precedence to: explicit per-run operator override > task binding/profile > neutral childSession defaults > legacy codex childSession alias > built-in defaults. Record per-field provenance in `config.resolved.json` and the event log.
- Keep `codex.childSession` as a compatibility alias for one migration window; new docs and presets should write only neutral `childSession` and `agents`.
- Add a `policy.effective` or `capabilityGates` section to project inspect / run preview output so users see enabled, disabled, degraded, and why before launch.

Migration path from current 0.7.0-style config:

1. Keep `version: 1` -> `"0.6.0"` as the first migration already supported.
2. Add a new migration from `"0.6.0"` to the vNext config version. The dry run should list every added policy field, its default, and whether it can change runtime behavior.
3. Preserve existing `paths`, `statuses`, `tracker`, `verify`, `git`, `pr`, `implement`, `orchestrator`, `childSession`, `codex.childSession`, and `agents` values.
4. Insert explicit safe vNext blocks:
   - `approval.mode: assisted`
   - `approval.autoMaxRiskTier: low`
   - default dependency install auto-grant limited to declared package manager and registry hosts
   - lifecycle scripts, arbitrary network, secrets, and outside-worktree writes not auto-granted
   - autonomous capabilities off except narrow `escalationAutoGrant` for dependency install
5. If an existing repo has `pr.merge.auto: true`, do not set `capabilities.autoMerge: true` automatically. Emit a migration warning: "PR policy permits auto-merge, but vNext autonomous auto-merge remains disabled until explicitly enabled and gates pass."
6. If an existing profile sets `approvalPolicy: never` for `implementStory`, leave the file value intact but migration status should warn that vNext approval relay requires `on-request`; the resolved vNext launch policy should either override via explicit vNext approval policy or block before launch if the repo refuses it.
7. For legacy run artifacts, rebuild projections from `events.ndjson` where present. Where no event log exists, mark artifacts read-only/legacy and refuse mutating recovery or merge decisions from them.

## Tradeoffs and Risks

- Compatibility: Explicit migration adds config churn, but it prevents hidden semantic changes. The dry-run output must be clear enough that users understand which new powers remain off.
- Safety: Default dependency-install auto-grant is necessary for usable fresh worktrees, but it is still a supply-chain risk. Keeping it lockfile-respecting, host-scoped, and separated from lifecycle scripts is the safety boundary.
- UX: Users with `pr.merge.auto: true` may expect auto-merge to continue. vNext should explain that merge permission and merge capability are now separate: policy allows, gates decide, runtime proves.
- Maintenance: Every new capability needs docs, schema, preset values, migration metadata, project-inspect output, and tests. This is more work than relying on implicit defaults, but it is testable.
- Version drift: Codex approval/control details are version-sensitive. Static config must not assert that `app-server`, live interrupt, or approval relay exists without a probe result.
- Backward compatibility: Removing or renaming `codex.childSession`, `childSession.approvalPolicy`, or `pr.merge.auto` immediately would surprise existing users. Keep aliases and warnings through at least one documented transition window.

## Fallback and Degraded Modes

- Missing vNext policy blocks: classify the config as supported-stale; read-only inspection may continue, but live autopilot should preview the migration and require explicit acknowledgement for behavior-changing runs.
- Runtime cannot catch approvals: no dependency auto-grant, no unattended run. Park before launch or stop with a clear `approval-relay-unavailable` diagnostic.
- Runtime can launch but not own/kill the process: allow observe-only execution only where no autonomous irreversible action is enabled; block `autoMerge`, `autoRecover`, and `autoRelaunch`.
- No declared registry or package manager: do not infer arbitrary network safety. The first install request parks for human approval with a suggested config patch.
- Existing `pr.merge.auto: true` but `capabilities.autoMerge: false`: create/push PR and gather readiness evidence, then stop before merge with a capability-gate record.
- Newer config than runtime: fail closed for config-dependent actions and tell the user to upgrade the runtime.
- Older unsupported config: fail closed except for `config status` / `config upgrade`.
- Legacy run artifacts without `events.ndjson`: expose read-only analysis only; recovery and merge actions require operator intervention.

## Validation Spikes

- Add migration fixtures for `version: 1`, `"0.6.0"` push-only, `"0.6.0"` push-and-merge, and a repo with custom `agents.profiles.storyImplementer.approvalPolicy`.
- Build a resolved-policy preview that prints per-field provenance and effective capability decisions for at least: default repo, `pr.merge.auto: true`, operator `--sandbox danger-full-access`, and driver without approval relay.
- Unit-test capability evaluation as pure predicates over config plus probe evidence: approval relay supported, child owned/killable, event log coherent, CI/review status known.
- Fake-driver integration test: approval request to declared registry auto-grants; lifecycle script escalates; undeclared host parks; high-risk request always requires human.
- Artifact migration test: rebuild state/summary/launch projections from captured legacy `events.ndjson`; mark no-event legacy runs read-only.
- Docs/schema drift test: require every vNext config field in `references/config.schema.json`, `references/config-schema.md`, presets, and local plugin fixtures.

## Open Questions

- What exact config schema version should vNext use: package-aligned, for example `"0.8.0"`, or an independent config-contract version?
- Should `capabilities.escalationAutoGrant` default true for the narrow dependency-install policy, or should even that require explicit repo opt-in?
- How should `provisioning.packageManagers` be auto-detected and written during migration without overfitting to npm/pnpm?
- Should lifecycle scripts default to medium human approval, or should repos be able to mark specific package-manager lifecycle phases as low risk?
- What is the exact transition window for `codex.childSession` and `approvalPolicy: never` story profiles?
- Should live autopilot block on supported-stale config by default, or allow one run after an explicit per-run acknowledgement?
- Which R1/R3 probe result names become stable public capability keys?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [R10 - Observability and Incident Analysis](./R10-observability-analysis.md) · **Next →:** [R12 - Distributed Coordination and Concurrency](./R12-coordination-concurrency.md)

<!-- /DOCS-NAV -->
