# OpenAI Harness engineering

Source: <https://openai.com/index/harness-engineering/>
Published: 2026-02-11
Accessed: 2026-06-22
Scope used: agent-first repository design, harness capabilities, repository knowledge, review loops,
mechanical constraints, autonomy, and cleanup loops.

## Summary

OpenAI describes a five-month experiment building an internal beta product with Codex writing all
repository content: product code, tests, CI, docs, tooling, observability, review comments, and
repository-management scripts. The core lesson is not "let agents code more." It is that engineering
work shifts toward designing a harness where agents can see the right context, use normal tools,
receive mechanical feedback, and work inside enforceable boundaries.

For kit-vnext, the article is useful as a harness-design reference, not a replacement control-plane
spec. The strongest overlap is with kit-vnext's existing commitments: repository-local knowledge,
progressive disclosure, evidence over prose, explicit seams, capability gating, and a deterministic
runner that owns verification and merge authority.

## Main Guidelines

- Optimize the repository for agent legibility. If knowledge is not visible to the agent while it is
  working, treat it as absent.
- Keep the top-level agent instruction file short. Use it as a map to deeper, owned source-of-truth
  docs rather than as a monolithic manual.
- Make plans, design docs, generated references, quality reports, and technical debt records
  versioned repository artifacts.
- Prefer progressive disclosure: start agents from a stable entry point, then point them to the
  specific docs and tools needed for the task.
- Treat agent failures as harness-design feedback. Ask what capability, context, tool, invariant, or
  feedback loop is missing instead of merely retrying the prompt.
- Expose runtime evidence directly to agents: UI state, screenshots, navigation traces, logs, metrics,
  traces, test output, review feedback, and CI state.
- Enforce architecture mechanically. Use dependency rules, structural tests, custom linters, and
  remediation-oriented error messages.
- Encode taste as enforceable invariants when repeated review feedback or defects show that docs are
  insufficient.
- Enforce boundaries centrally and leave local implementation freedom inside those boundaries.
- Pay down agent-induced drift continuously through small cleanup tasks instead of periodic manual
  cleanup bursts.

## Assumptions And Operating Model

- The case study is a greenfield repository, started from an empty git repo in late August 2025.
- The team deliberately used a "no manually written code" constraint to force investment in Codex
  leverage and harness quality.
- Humans steer at the intent, acceptance-criteria, prioritization, and outcome-validation layers.
  Agents execute implementation, review response, tooling, docs, and repository maintenance.
- Agents use standard developer tools directly, including local scripts, GitHub tooling, repo skills,
  and review surfaces.
- Work is PR-centered and highly iterative. Agents can review locally, request additional agent
  reviews, respond to feedback, fix build failures, and drive changes toward merge.
- The app is bootable per git worktree. Each task can get an isolated app instance plus an ephemeral
  observability stack.
- The harness exposes browser automation and observability APIs to Codex, making UI behavior and
  runtime health inspectable without human copy/paste.
- The merge philosophy assumes very high agent throughput and relatively cheap follow-up
  corrections. That assumption is not universal.

## Failure Modes And Anti-Patterns

- Giant `AGENTS.md` files fail as durable control surfaces. They consume scarce context, flatten
  priority, rot quickly, and are hard to verify mechanically.
- Important decisions in chat, external docs, or human memory become invisible operating constraints.
  Agents cannot reliably preserve what they cannot inspect.
- Underspecified environments produce slow or brittle progress. The missing piece is often a tool,
  abstraction, test, or source-of-truth artifact, not more human exhortation.
- Documentation-only standards do not hold under high automated throughput. Repeated mistakes need
  lint rules, structural tests, templates, or generated checks.
- Agents replicate existing repository patterns, including weak or obsolete ones. Bad examples become
  seeds for future drift.
- Manual cleanup does not scale once agents generate change at high volume.
- Opaque dependencies and unstable APIs can reduce agent leverage when the agent cannot inspect,
  test, or reason about the behavior locally.
- Guessing external data shapes is called out as a bad pattern. Boundary validation or typed SDKs are
  safer harness inputs for agents.
- Blocking every flake or minor imperfection can become counterproductive in the article's
  high-throughput setting, but copying that posture blindly would be dangerous in lower-throughput or
  higher-risk systems.

## Practices Worth Copying

- Keep `AGENTS.md` as a concise table of contents, then make the owned docs navigable,
  cross-linked, and mechanically checked.
- Add doc-gardening checks that find stale guidance, broken cross-links, obsolete generated docs, and
  rules that no longer match code behavior.
- Make runtime state queryable by agents. For kit-vnext, the closest analog is exposing event logs,
  projections, run artifacts, task snapshots, approval state, review threads, CI results, and
  worker/runner evidence through stable local commands.
- Build per-worktree harnesses. A task should have isolated workspace, process, logs, and artifacts
  so an agent can reproduce, verify, and clean up without cross-run contamination.
- Treat observability as an agent input, not only a human dashboard. Agents should be able to query
  structured logs, metrics, traces, and timing evidence from the task-local environment.
- Write custom lints and structural tests with agent-useful failure messages: what failed, why the
  invariant exists, and where to look for the expected pattern.
- Track quality and debt as repository artifacts. Use recurring small refactor tasks to prevent
  drift from compounding.
- Convert repeated human review comments into durable docs or automated checks.
- Prefer boring, stable, inspectable abstractions when they improve agent reasoning. Reimplementation
  can be justified for small, heavily tested, harness-critical helpers, but should not become a reflex.
- Design prompts around acceptance criteria and evidence the agent can collect, not around human-only
  context.

## Relevance To Kit-vnext

- The article reinforces kit-vnext's core premise: the high-value product is the control harness, not
  ad hoc agent prompting.
- Kit-vnext already has a stronger safety model than the article's public summary: deterministic
  control plane, append-only event log, provider seams, capability attestation, evidence gates, and
  worker/runner isolation.
- The OpenAI operating model supports making repository-local docs and artifacts first-class
  contract surfaces. That aligns with `docs/design/` as source of truth and the current short
  `AGENTS.md` map.
- "Agent legibility" should be explicit in kit-vnext evaluation. A provider, domain, or workflow is
  not ready if the worker or runner cannot inspect the evidence needed to act safely.
- The per-worktree app and observability pattern maps directly to kit-vnext's Execution Host,
  Workspace & Repository, Storage & Artifacts, and Observability & Analysis domains.
- The article's review loop validates kit-vnext's distinction between worker evidence and runner
  authority. Agents can gather signals and propose changes; the runner should bind verification,
  Forge actions, and merge decisions to recorded evidence.
- The "promote rule to code" pattern belongs in kit-vnext's conformance suites, dependency checks,
  policy checks, and driver capability probes.
- Continuous cleanup suggests a future Work Source track for hygiene tasks: stale docs, weak lints,
  incident replay gaps, duplicated helper patterns, and unverified assumptions.
- The article's emphasis on local, tool-mediated evidence supports kit-vnext's evidence-over-prose
  invariant and argues against accepting worker self-reports as completion proof.

## Caveats For Synthesis

- This is an OpenAI self-report about one internal product, not an independent benchmark or a general
  guarantee about Codex performance.
- The reported throughput depends on a greenfield repo, heavy harness investment, direct tool access,
  repository-specific skills, isolated worktree runtime, and observability plumbing.
- The article explicitly warns that the described autonomy depends on the repository's structure and
  tooling. Do not generalize it to kit-vnext without equivalent attestations and evidence gates.
- Their agents often perform credentialed repository operations. Kit-vnext should not copy that
  literally because AD-12 separates worker implementation from runner-owned Forge authority.
- Their minimal blocking merge philosophy is context-dependent. Kit-vnext should preserve
  evidence-gated completion and make any "fast follow" policy explicit, bounded, and auditable.
- "No manually written code" is a forcing function for the experiment, not a requirement kit-vnext
  should adopt. Human control remains part of kit-vnext's v1 safety model.
- Reimplementing small dependencies can improve agent legibility, but it can also increase ownership
  cost. Use it only when the helper is small, stable, well-tested, and central to harness invariants.
- The article's strongest durable lesson is about investment direction: encode knowledge, feedback,
  evidence, and constraints into the repository and tools so agent work becomes inspectable,
  repeatable, and correctable.
