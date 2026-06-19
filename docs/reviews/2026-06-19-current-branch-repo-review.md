# Current Branch Repo Review Report

Date: 2026-06-19
Branch reviewed: `v-next`
Reviewed commit: `ca34bbd11025479f30a22960258e285c6a4d41ca`
Review branch: `codex/current-branch-repo-review-report`
Report path: `docs/reviews/2026-06-19-current-branch-repo-review.md`

## Purpose

This report captures the read-only current-branch review requested after the v-next scaffold and
design-finalization phases. The goal was not to implement fixes. The goal was to evaluate whether the
repository structure, tooling, configuration, tests, and design corpus are ready to support
implementation planning.

The review focused on:

- General repo structure, governance files, and non-doc Markdown.
- pnpm scripts, TypeScript, Biome, Vitest, dependency-cruiser, CI, and the Turborepo decision.
- The `docs/` tree, excluding `docs/history/**`, with emphasis on implementation readiness of the
  design corpus.

## Scope And Constraints

The review used tracked files only:

- Included: `git ls-files ':!:docs/history/**'`
- Excluded: untracked files and `docs/history/**`
- Open PRs into `v-next` were treated as concurrent external work and were not reviewed.
- No source files were edited during the review.
- No commits, pushes, PR updates, or merge actions were performed during the review.

Baseline evidence:

- Main checkout was clean on `v-next...origin/v-next`.
- Reviewed HEAD was `ca34bbd11025479f30a22960258e285c6a4d41ca`.
- Node version was `v24.13.1`.
- pnpm version was `11.5.1`.
- Total tracked files: 481.
- Tracked files excluding `docs/history/**`: 449.
- Non-doc tracked files excluding history: 28.
- Docs tracked files excluding history: 421.
- No tracked `turbo.json` exists.

## How The Review Was Run

The review followed the orchestrated-delivery plan but used read-only explorer/reviewer contexts
instead of implementer/review loops. Subagents were scoped by ownership area:

| Alias | Area | Outcome |
|---|---|---|
| `p1-shell-review` | Repo structure, governance, and non-doc Markdown | Needs changes |
| `p1-tooling-review` | pnpm scripts, CI, test lanes, TypeScript, Biome, dependency-cruiser, Turbo decision | Needs changes |
| `p1-docs-spine-review` | Docs navigation, foundation docs, design corpus spine | Needs changes |
| `p2-seams-foundation-review` | Foundation and provider design readiness | Needs changes |
| `p2-provider-evidence-review` | Provider evidence inventory and reproducibility | Needs changes |
| `p2-core-review` | Core domain design quality and implementation readiness | Ready with reservations |
| `p3-edge-synthesis-review` | Edge domain and cross-corpus synthesis | Ready with reservations for edge; overall needs changes |

The coordinator also ran non-mutating checks and targeted searches to reconcile findings:

- `git status --short --branch`
- `git ls-files` inventory checks
- `pnpm check`
- `pnpm pack:dry-run`
- targeted `rg` searches for stale references, status drift, readiness language, and evidence paths

Official current documentation was used for guidance-sensitive tooling judgments:

- pnpm workspace and CI docs
- Vitest 4 project and `passWithNoTests` behavior
- Biome formatter/linter docs
- Turborepo docs

## Verification Evidence

`pnpm check` passed:

- `pnpm format:check`
- `pnpm lint`
- `pnpm deps`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:int`
- `pnpm test:conf`

Important details from the run:

- Biome checked 10 files with no fixes applied.
- dependency-cruiser found no violations across 10 modules and 11 dependencies.
- Unit tests passed: 2 files, 6 tests.
- Integration and conformance-mock lanes had no tests and passed because the scripts use
  `--passWithNoTests`.

`pnpm pack:dry-run` passed, but it surfaced a review finding:

- The root package is private and has no `files` allowlist.
- The dry run packed broad repository content.
- The package inventory included `.github/**`, `docs/design/**`, and `docs/history/**`.
- `docs/history/**` was not reviewed as content; it only appeared in the pack inventory.

## Overall Verdict

Overall verdict: needs changes before broad implementation starts.

Limited planning can continue in parallel for:

- Gate hardening.
- Package decomposition.
- Foundation/core implementation-story planning.

Do not start real provider or edge implementation until these issues are resolved:

- Readiness and status model ambiguity.
- Stale root/governance documentation.
- Provider evidence provenance paths that no longer reproduce from the current tree.
- Missing credential config surface between `fnd-01` and `fnd-04`.
- Edge envelope parity ambiguity.
- Stable public token naming inconsistency in core contracts.

## Area Findings

### 1. Repo Structure And Governance

Verdict: needs changes.

Files and groups reviewed:

- Root governance Markdown: `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- Package scaffold and root config context: `packages/README.md`, `package.json`,
  `pnpm-workspace.yaml`, `tsconfig*.json`, `biome.json`, `.dependency-cruiser.cjs`, `.gitignore`.
- GitHub governance: `.github/CODEOWNERS`, issue templates, PR template, Dependabot config, and
  workflow policy comments.

Required findings:

1. `CONTRIBUTING.md` is stale enough to mislead implementers.
   It points to missing `docs/architecture.md` and describes legacy surfaces such as `skills/`,
   `references/`, `presets/`, `examples/`, `packages/orchestrator/`, plugin mirrors, changesets, and
   `main` release flow. The current repo contract says `docs/design/` is authoritative and
   `packages/` is intentionally empty until design owners fill it.

2. `README.md` conflicts with the current tracked design corpus.
   It says architecture and domain designs live on a separate design branch and will be repopulated
   later. The current branch already tracks `docs/design/architecture.md`, and `AGENTS.md` makes
   `docs/design/` the source of truth.

3. GitHub templates and automation still target legacy/default-branch assumptions.
   `AGENTS.md` says PRs should target `v-next` and `main` is frozen, but Dependabot has no
   `target-branch: v-next`. Issue template links point to `tree/main/docs`.

4. `SECURITY.md` describes pre-vNext support.
   It still describes `0.5.x` support and legacy directories such as `skills/` and `references/`.

5. The PR template under-describes the actual gate and includes obsolete mirror requirements.
   It summarizes `pnpm check` as Biome lint, TypeScript, and Vitest, omitting format and dependency
   graph checks. It also references untracked legacy canonical-source mirrors.

Required fixes:

- Rewrite `README.md`, `CONTRIBUTING.md`, and `SECURITY.md` for kit-vnext.
- Add `target-branch: v-next` to Dependabot if dependency PRs should target the rebuild line.
- Update issue-template documentation URLs from `main` to `v-next` or to branch-neutral docs URLs.
- Replace obsolete PR template mirror checklist items with current v-next requirements.

Optional cleanup:

- Add `perf` and `ci` to the PR template type checklist if those remain allowed conventional
  subjects.
- Update workflow comments that refer only to "main's ruleset" so they also reflect `v-next`.

### 2. Tooling, Scripts, Tests, And CI

Verdict: needs changes.

Files reviewed:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `tsconfig.base.json`
- `tsconfig.infra.json`
- `vitest.config.ts`
- `biome.json`
- `.dependency-cruiser.cjs`
- `.github/workflows/check.yml`
- `.github/dependabot.yml`
- `tests/infra/**`
- `tooling/no-side-effects.setup.ts`

Required findings:

1. `pack:dry-run` is currently a weak publishability gate.
   The root package is private, has no `files` allowlist, and the dry run packs broad repo content,
   including `docs/history/**`. CI runs this script as a publishability check, but it is not yet
   checking the final package artifact shape.

2. Required Vitest lanes should not keep `--passWithNoTests` once implementation packages land.
   `unit`, `integration`, and `conformance-mock` all use `--passWithNoTests`. That is acceptable as
   scaffold escape hatch, but it can hide broken globs or omitted conformance suites later.

3. Workspace docs and config drift.
   `pnpm-workspace.yaml` currently includes only `packages/*`, while foundation docs say packages are
   declared under `packages/`, `tooling/`, and `tests/`. There are no package manifests under
   `tooling/` or `tests/` today, so this is not a functional bug yet, but it is misleading.

Positive findings:

- Vitest 4 uses current `test.projects` shape with clear lane names and include patterns.
- Biome scripts and config are coherent for the current small scaffold.
- dependency-cruiser is wired and passed live.
- CI shape matches pnpm guidance: install pnpm, set up Node with pnpm cache, frozen install, then run
  the gate.
- Turborepo should not be added now. There is no tracked `turbo.json`, no real workspace package
  graph, and no cacheable package scripts yet. Revisit when multiple packages have meaningful
  `build`, `typecheck`, and test scripts.

Required fixes and decisions:

- Decide whether the publishable unit is the root package or future package-level artifacts.
- Add a `files` allowlist or package-level pack checks before relying on pack dry-run as a real
  publishability gate.
- Set a sunset condition for `--passWithNoTests` in required lanes.
- Reconcile `pnpm-workspace.yaml` and foundation docs.

### 3. Docs Spine And Foundation Docs

Verdict: needs changes.

Files reviewed:

- `docs/README.md`
- `docs/roadmap.md`
- `docs/foundation/**`
- `docs/design/README.md`
- `docs/design/architecture.md`
- `docs/design/requirements.md`
- `docs/design/decisions.md`
- `docs/design/conventions.md`
- `docs/design/glossary.md`
- `docs/design/domains/README.md`
- `docs/design/_templates/domain-design-template.md`

Required findings:

1. Domain readiness/status model is not implementation-planning ready.
   The catalog has a status legend for `mandate: ready` and `design: draft | in-review | approved`,
   but the catalog table does not expose those statuses. The template has a single `status` field,
   and conventions say approval flips frontmatter `status` to `approved`.

2. `docs/roadmap.md` is stale or contradictory.
   Earlier steps still show `in progress`, later steps show `done`, and Step 4 uses durable-doc
   wording like `done - this PR`.

3. Foundation workspace docs do not match the tracked workspace manifest.
   See the tooling section above.

4. Zero-real-process guard docs overstate current coverage and mechanics.
   Foundation docs claim all process-spawning and network APIs are stubbed and describe mechanics
   that differ from the actual setup. The implementation uses `vi.mock` for selected Node builtins
   and `vi.stubGlobal` for `fetch`.

Required fixes:

- Add a clear readiness/status matrix for each domain.
- Refresh `docs/roadmap.md` to current branch reality.
- Make foundation docs distinguish current scaffold behavior from intended future policy.
- Replace durable wording such as `this PR` with stable commit/branch references or neutral status.

### 4. Foundation And Provider Designs

Verdict: needs changes.

Files reviewed:

- All tracked non-JSON files under `docs/design/domains/foundation/**`.
- All tracked non-JSON provider design/evidence-index files under `docs/design/domains/providers/**`.
- Large generated provider evidence was grouped through indexes, summaries, and spot checks.

Required findings:

1. Provider/domain readiness is overstated and internally inconsistent.
   Provider domains are marked `approved`, but the provider-validation Definition of Done is still
   incomplete in several places:

   - `prov-01`: live approval, resume, tool-exit, and parentage proof incomplete.
   - `prov-03`: executable Markdown/mock drivers are fixture-only.
   - `prov-04`: real Local driver validation, native helper, and live egress negative probes
     incomplete.
   - `prov-02`: write-side GitHub smoke remains open even though provider validation is marked
     complete.

   Clarification: the contract/driver split is intentional and should be preserved. The issue is not
   that provider contracts were designed separately from concrete drivers. That separation is the
   desired seam. The issue is status semantics: the docs should make clear when a provider contract
   is design-approved based on empirical evidence and past runs, versus when a concrete driver has
   executable mock and real-driver conformance.

2. Credentials are not implementable from the current config contract.
   `fnd-04` says Configuration & Policy supplies credential references/defaults and consumes
   `CredentialRef` records, but `fnd-01`'s `PolicyLayer` does not define credential, secret, or
   egress-policy source fields.

3. The domain catalog dependency map disagrees with domain frontmatter and body text.
   Examples include `prov-03`, `fnd-03`, and `fnd-04` catalog entries, plus omitted `fnd-04`
   dependencies for provider domains that consume credentials.

Required fixes and decisions:

- Split `design approved` from `implementation/conformance ready` without merging contract and driver
  concerns. Recommended status model: contract/API/workflow design approved, evidence captured,
  mock/adversarial model designed or partial, real driver implementation pending, real driver
  conformance pending, runtime capability attestation absent until probed.
- Decide where credential refs and egress policy are configured.
- Sync catalog dependency entries with domain frontmatter and design body text.
- Add a provider readiness matrix: schema evidence, mock conformance, real smoke, open capability
  gaps.

### 5. Provider Evidence

Verdict: needs changes.

Files grouped:

- `prov-01`: 338 evidence files, including generated Codex app-server schemas, probes, index,
  shasums, and adversarial fixture JSONL.
- `prov-02`: 19 evidence files, including GitHub GraphQL schema snapshots, index, mock forge
  conformance output and snapshot.
- `prov-03`: 3 evidence files, including Markdown and mock work-source fixtures.
- `prov-04`: 6 evidence files, including design evidence, command/termination captures, schema-line
  snapshot, and mock host snapshots.

Structured evidence finding:

- All tracked JSON and JSONL evidence files parsed cleanly.

Required findings:

1. Evidence provenance is not directly reproducible from the current branch.
   Evidence commands and checksum manifests still point to `docs/kit-vnext/**`, but that tree is not
   tracked on this branch. The current tree is under `docs/design/domains/providers/**`.

2. The generated-schema corpus needs a refresh manifest.
   `prov-01` commits 329 generated schema files plus probes/index/shasums. Future refreshes will be
   large and hard to review without a small manifest or script stating generator version, command,
   expected file count, validation command, and review policy.

3. Implementation readiness depends on future conformance.
   The evidence is good design-stage source material, but it should not be treated as capability
   proof. Live capabilities remain absent until executable conformance emits fresh attestations.

Required fixes:

- Refresh all `docs/kit-vnext/**` provenance paths to current tracked paths or use a documented
  root-relative variable.
- Regenerate or rewrite `prov-01` shasums so `shasum -a 256 -c` works from the repo root.
- Add a generated-schema manifest or regeneration script for `prov-01`.
- Keep capability-gate language strict: evidence supports contract shape, not live capability.

### 6. Core Domains

Verdict: ready with reservations.

Files reviewed:

- Shared context: `docs/design/architecture.md`, `requirements.md`, `conventions.md`, `glossary.md`,
  and `domains/README.md`.
- All 19 tracked files under `docs/design/domains/core/**`.

Positive finding:

- The core spine is coherent enough to start implementation planning in catalog order, especially
  `core-01` then `core-02`. Designs consistently use event-log replay, pure predicates,
  fail-closed states, mock-only core tests, and provider seams rather than concrete drivers.

Required findings before stable contracts are coded:

1. String token vocabulary conflicts with the design convention.
   The convention says string-literal state/reason/error tokens are kebab-case, but several core
   contracts define snake_case public tokens.

2. `core-05` dependency/catalog order is stale.
   The catalog implies `core-05` can proceed largely in parallel after core-01/core-02, but `core-05`
   consumes core-03 approval events.

3. `core-01` requirement/open-question ownership is internally inconsistent.
   FR-1 names Run Lifecycle as a primary domain, the testing section says core-01 satisfies FR-1,
   but the core-01 owned-requirements list omits FR-1. The mandate also lists durability/storage as
   open while the design later says no v1 open questions remain.

4. `core-07` narrows the NFR-OBS terminal-analysis invariant.
   Requirements say every terminal run has `AnalysisRecorded` or `AnalysisFailed`; core-07 narrows
   this to terminal runs with usable replay health. Tests need an explicit exception or recovery
   invariant.

Required fixes and decisions:

- Normalize public string tokens to kebab-case or explicitly ratify exceptions.
- Update catalog ordering so core-05 waits on core-03 event contracts, or define a temporary
  fail-closed stub strategy.
- Clarify core-01 FR-1 ownership and resolved open questions.
- Clarify the NFR-OBS exception model for corrupt/unwritable logs.

### 7. Edge Domain

Verdict: ready with reservations.

Files reviewed:

- `docs/design/domains/edge/edge-01-operator-surface/README.md`
- `docs/design/domains/edge/edge-01-operator-surface/attention-explainability-and-triggers.md`
- `docs/design/domains/edge/edge-01-operator-surface/command-surface-and-envelopes.md`

Positive finding:

- Dependency direction is aligned. Edge consumes the control-plane `OperatorControlPort`, does not
  obtain `RunWriter`, and treats attention/explainability as rendered recorded facts.

Required findings:

1. Stale design-root reference.
   Edge says no material outside `docs/kit-vnext` was used. The repo contract and conventions now
   make `docs/design/` authoritative.

2. Envelope parity over-constrains generated fields.
   The request envelope includes `actionId`, `idempotencyKey`, and `requestedAt`, then requires MCP
   and CLI to produce the same envelope bytes except a short field list that omits `actionId` and
   `idempotencyKey`. Clarify whether those are deterministic parity fields or generated invocation
   fields.

3. Open product/policy decisions need explicit implementation gates.
   Notification transports and retention/redaction for operator reasons and explanation transcripts
   remain open. That is acceptable for design approval, but should be split into v1 scope versus
   deferred work before edge implementation stories are cut.

Required fixes and decisions:

- Replace `docs/kit-vnext` references with `docs/design`.
- Decide whether `actionId` and `idempotencyKey` participate in byte-for-byte parity or are excluded
  generated fields.
- Define v1 edge scope gates for notification transport, reason retention, and explanation transcript
  redaction.

## Cross-Corpus Required Fixes And Decisions

The following are the highest-priority fixes before broad implementation:

1. Establish one readiness model.
   Decide whether `status: approved` means design-approved only, or implementation/conformance-ready.
   If it means design-approved only, add a separate implementation readiness matrix. This should
   preserve the intentional split between evidence-informed provider contracts and concrete driver
   conformance.

2. Refresh root governance docs.
   Update `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, issue templates, Dependabot config, and PR
   template for v-next.

3. Fix the roadmap.
   Replace stale `in progress` and `done - this PR` states with durable, current status.

4. Harden the gate.
   Define pack target boundaries, remove or sunset `--passWithNoTests` for required lanes, and
   activate layer dependency rules once package decomposition exists.

5. Decide package decomposition and dependency lint timing.
   The design says package decomposition is design-owned; tooling currently has only template layer
   rules. Implementation planning needs package names and dependency ownership before code lands.

6. Resolve `fnd-01` and `fnd-04` credential contract drift.
   Either add credential references and egress policy to config, or revise fnd-04 so it does not
   claim config supplies them.

7. Normalize provider evidence provenance.
   Replace stale `docs/kit-vnext/**` commands and shasum paths with current `docs/design/**` paths.

8. Add provider conformance readiness tracking.
   Provider evidence supports design claims, but not live capability attestation. Track each provider's
   mock conformance, real smoke, negative probes, and missing capabilities.

9. Fix core contract token naming.
   Normalize public string tokens to kebab-case or document approved exceptions before persisted logs
   and tests depend on them.

10. Fix core dependency order drift.
    core-05 consumes core-03 approval events and should not be planned as independent of that event
    contract.

11. Clarify edge envelope generated fields.
    Decide how `actionId`, `idempotencyKey`, and `requestedAt` behave in MCP/CLI parity tests.

12. Resolve the remote-execution seam wording.
    `docs/design/README.md` says remote execution is behind the Agent seam, while AD-13 assigns remote
    execution to the Execution Host seam.

## Suggested Fix Sequencing

1. Governance/docs truth pass:
   root docs, roadmap, readiness/status model, branch/template defaults, and stale `docs/kit-vnext`
   references.

2. Evidence and gate hardening:
   provider evidence paths/shasums, generated-schema manifest, pack target, `passWithNoTests` sunset,
   and workspace docs/config reconciliation.

3. Design contract reconciliation:
   fnd-01/fnd-04 credential surface, catalog dependencies, core token naming, core-05 ordering,
   core-01 ownership, and core-07 NFR-OBS exception.

4. Implementation planning:
   begin with core-01/core-02 and package decomposition after the above decisions are recorded. Keep
   provider and edge implementation behind conformance/readiness gates.

## Optional Cleanup

- Add a top-level provider evidence inventory table with capture date, source version, hash manifest,
  validation command, and known limitations.
- Add lightweight `README.md` files in provider evidence directories that currently use only appendix
  files.
- Add selected schema summaries for the large Codex schema corpus so reviewers do not need to open
  huge JSON files for ordinary design checks.
- Normalize domain IDs and frontmatter status values.
- Decide whether `format:check` should be documented as `biome format .` or changed to
  `biome format --check .` for clarity.
- Align PR template type checkboxes with all conventional subjects allowed by `AGENTS.md`.

## Final Notes

This report intentionally captures review findings only. It does not propose code changes beyond the
fix and decision list above. Any remediation should be planned as a separate work item, ideally in a
worktree from `v-next`, with focused commits by area.
