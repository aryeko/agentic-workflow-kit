# Infrastructure, Tooling, And Framework Research Report

Date: 2026-06-19
Branch context: `v-next`
Research branch: `codex/current-branch-repo-review-report`
Report path: `docs/reviews/2026-06-19-infra-tooling-framework-research.md`

## Purpose

This report captures the follow-up research on infrastructure, tooling, frameworks, and OSS
libraries that can support the intended kit-vnext architecture without weakening its design
constraints.

The triggering question was whether the implementation should use a dependency injection framework
such as Inversify, or other OSS libraries, to improve maintainability, reduce custom code, and keep
the system testable, extensible, observable, and aligned with SOLID.

This is a recommendation report only. No dependencies were installed, no source code was changed, and
no implementation decision is considered accepted until the design corpus records it.

## Scope And Constraints

The research was bounded by the current v-next design:

- The design corpus under `docs/design/` is the source of truth.
- The control plane must remain deterministic and host-neutral.
- The core depends only on contracts and foundation.
- Drivers implement provider contracts and contain host/tool-specific risk.
- External effects must be behind seams: Agent, Execution Host, Forge, Work Source, Workspace,
  Credentials, Storage, and Config.
- Event log remains the single source of truth.
- Capability attestation, fail-closed behavior, and provider conformance are first-class requirements.
- The worker/runner credential boundary must remain hard.

The report evaluates fit for these quality attributes:

- SOLID and explicit dependency direction.
- Testability with mock providers and zero real process/network core tests.
- Extensibility where adding a driver touches only that provider's folder.
- Observability through structured events and telemetry without replacing the event log.
- Security and credential isolation.
- Maintainability and coding effort reduction.

## How The Research Was Run

The research combined local design review with current official/library documentation checks.

Local repo context checked:

- `docs/design/architecture.md`
- `docs/design/requirements.md`
- `docs/design/domains/README.md`
- `.dependency-cruiser.cjs`
- `package.json`

Current docs and primary sources checked:

- InversifyJS 8 docs: https://inversify.io/docs/introduction/getting-started/
- Awilix README/docs: https://github.com/jeffijoe/awilix
- Zod 4 docs: https://zod.dev/ and https://zod.dev/json-schema
- fast-check Vitest integration: https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-vitest/
- OpenTelemetry JavaScript docs: https://opentelemetry.io/docs/languages/js/
- Pino docs: https://getpino.io/ and https://github.com/pinojs/pino/blob/main/docs/api.md
- Execa README: https://github.com/sindresorhus/execa
- p-limit README: https://github.com/sindresorhus/p-limit
- p-queue README: https://github.com/sindresorhus/p-queue
- Octokit docs: https://github.com/octokit/octokit.js/ and
  https://docs.github.com/rest/guides/scripting-with-the-rest-api-and-javascript
- XState docs: https://stately.ai/docs/xstate
- Node.js SQLite docs: https://nodejs.org/api/sqlite.html
- better-sqlite3 README: https://github.com/WiseLibs/better-sqlite3

## Baseline Evidence

Current repo dependency posture:

- Runtime dependencies: none.
- Dev dependencies: Biome, TypeScript, Vitest, dependency-cruiser, Node types.
- Package decomposition has not landed yet; `packages/` is intentionally scaffold-only.
- Layer dependency-cruiser rules are documented as a template but not active because packages do not
  exist yet.
- The design already defines the Dependency Rule as the SOLID guardrail.
- Requirements already define testability, observability, extensibility, safety, determinism,
  security, and operability as acceptance-checked NFRs.

## Overall Verdict

Verdict: ready with reservations.

The intended architecture should leverage OSS libraries, but selectively and at the boundaries. The
right default is not a full framework. The right default is:

- Plain TypeScript contracts.
- Explicit constructor or factory injection.
- Pure core state machines/reducers/policies where possible.
- Runtime libraries only in foundation, drivers, edge, tests, and composition roots.
- dependency-cruiser rules that enforce those boundaries before broad implementation.

Inversify should not be the default DI mechanism for kit-vnext. If a container is needed, Awilix is a
better candidate because it does not require decorators or `reflect-metadata` and can stay isolated to
composition roots.

## Architectural Policy Recommendation

Adopt this as an implementation guideline:

> Dependencies are passed explicitly. Core code receives ports as constructor or factory arguments,
> emits structured events through an injected event writer, and returns typed results. Runtime
> containers, SDK clients, loggers, process handles, clocks, randomness, filesystem access, and
> network clients are created only at composition roots, foundation modules, edge modules, or concrete
> drivers.

Required implications:

- Core modules must not import DI containers.
- Core modules must not import concrete SDKs such as Octokit, Execa, Pino, OpenTelemetry SDK, or
  provider clients.
- Core decisions must remain pure functions of recorded evidence.
- Drivers can use SDKs, but must expose contract-shaped outputs and capability evidence.
- Tests should override dependencies by constructing ports directly, not by mutating global state.
- Composition roots can assemble the graph, validate config, attach telemetry, and select drivers.

## Dependency Injection Decision

### Recommendation

Do not use Inversify as the default framework.

Use explicit injection first. Revisit a small Awilix composition-root spike only after package
decomposition exists and the first two or three providers create enough wiring duplication to justify
a container.

### Evidence

InversifyJS 8 current getting-started docs require installing `inversify` and `reflect-metadata`, and
warn that TypeScript `experimentalDecorators` and `emitDecoratorMetadata` must be enabled. The examples
use `@injectable`, `@inject`, a runtime `Container`, and binding metadata.

Awilix current docs describe a DI container that supports classes, factory functions, and values
without special annotations. It supports strict mode, registration APIs such as `asClass`,
`asFunction`, and `asValue`, and lifetimes including transient, scoped, and singleton.

### Evaluation

Inversify strengths:

- Mature TypeScript-oriented IoC container.
- Strong class-oriented DI model.
- Useful if the codebase chooses decorator-heavy object graphs.

Inversify risks for kit-vnext:

- Decorator metadata and runtime container behavior make dependencies less visible.
- `reflect-metadata` and TS decorator settings become global architectural choices.
- Container usage can become a service locator if allowed outside bootstrap.
- It encourages class metadata coupling that is unnecessary for deterministic core logic.
- It adds more magic than the current design needs.

Awilix strengths:

- No special annotations required.
- Easier to confine to the composition root.
- Supports classes, functions, and values.
- Strict mode and scoped lifetimes map well to run-scoped services.
- Easier to keep core code unaware of the DI mechanism.

Awilix risks:

- `container.cradle` and string-key resolution can hide dependencies if used directly in core.
- Auto-loading modules could bypass explicit architecture if used loosely.
- Lifetimes must be designed carefully so run-scoped state does not leak into process singletons.

### Required Decision

Decide one of these before broad implementation:

1. Preferred: no DI framework for initial core/foundation implementation.
2. Acceptable later: Awilix only in `edge`/bootstrap/composition roots and test composition helpers.
3. Not recommended: Inversify as a project-wide default.

### Required Guideline

If a container is adopted:

- The container must be created in a composition-root package only.
- No domain/core/provider-contract file may import the container.
- The container must not be passed as a dependency.
- Each resolved service must still have a statically declared interface or factory type.
- Tests may build lightweight test containers, but unit tests should prefer direct construction.

## Library Recommendations By Area

### 1. Runtime Schema Validation

Verdict: recommended.

Primary candidate: `zod` v4.

Where it fits:

- `fnd-01` Configuration & Policy.
- Event and artifact schema validation.
- Provider evidence parsing.
- Adoption diagnostics.
- Test fixture validation.
- JSON Schema generation for docs and external artifacts.

Why it fits:

- TypeScript-first schema definitions.
- Runtime validation for untrusted input.
- Inferred TypeScript types reduce duplicate model definitions.
- Zod 4 includes native JSON Schema conversion through `z.toJSONSchema`.

Reservations:

- Be careful with transforms and non-JSON-representable schema features if JSON Schema output is a
  required artifact.
- Avoid scattering schema definitions across unrelated packages.
- Decide whether schemas live with contracts, foundation, or per-domain packages before implementation.

Required decision:

- Select a schema ownership model:
  - Contract-owned schemas for public seam payloads.
  - Foundation-owned schemas for config, policy, artifacts, and event envelopes.
  - Driver-owned schemas for provider evidence and driver-specific probe outputs.

Optional alternative:

- `TypeBox + Ajv` if JSON Schema is the canonical source and high-throughput validation becomes more
  important than Zod's developer ergonomics.

### 2. Property-Based And Invariant Testing

Verdict: recommended.

Primary candidate: `fast-check` with `@fast-check/vitest`.

Where it fits:

- Core replay determinism.
- Run-state transition invariants.
- Capability gate predicates.
- Fail-closed policies.
- Event projection invariants.
- Lease/concurrency edge cases.
- Provider conformance adversarial mocks.

Why it fits:

- The requirements explicitly call for deterministic replay, invariant tests, and adversarial mocks.
- The current test runner is Vitest.
- fast-check's Vitest integration supports incremental adoption through enriched `test`/`it` APIs.

Required decision:

- Add a testing guideline that says property tests are required for:
  - State-machine transition reducers.
  - Capability gate predicates.
  - Replay/projection equivalence.
  - Fail-closed branches.

Optional cleanup:

- Add a `test:property` project only if property tests need separate timeout or seed handling. Otherwise
  keep them in unit/conformance projects.

### 3. Process Execution

Verdict: recommended at the Execution Host boundary only.

Primary candidate: `execa`.

Where it fits:

- `prov-04` Execution Host local driver.
- Runner-owned verification command execution.
- Capturing command, argv, cwd, env policy, stdout/stderr, exit code, timeout, and termination evidence.

Why it fits:

- It wraps `child_process` for programmatic command execution.
- It can reduce custom process plumbing.
- It should still be hidden behind the Execution Host contract.

Reservations:

- Process-tree termination, containment, and kill guarantees still need explicit probes and
  conformance tests.
- Shell execution must be avoided or tightly controlled.
- Execa does not replace the need for capability attestation such as `canKill` and containment checks.

Required decision:

- Define the Execution Host process-result contract before selecting the final process library.

### 4. Bounded Concurrency And Queues

Verdict: recommended, but small and targeted.

Candidates:

- `p-limit` for simple bounded concurrency.
- `p-queue` for richer queues, rate limits, pause/resume, and queue introspection.

Where it fits:

- Admission control around concurrent provider probes.
- Bounded artifact analysis.
- Forge API request coordination.
- Background analyzer fan-out.

Why it fits:

- The design requires operability, leases, backpressure, and bounded concurrency.
- These packages reduce custom queue code.

Reservations:

- They do not replace repo-level leases.
- They do not provide durable coordination across processes.
- Any queue decisions that affect run state must be recorded as events.

Required decision:

- Use `p-limit` first unless queue introspection or rate-limit lifecycle controls are needed.

### 5. Forge / GitHub Driver

Verdict: recommended.

Primary candidate: `octokit`.

Where it fits:

- `prov-02` Forge / Collaboration GitHub driver.
- PR creation, review-thread inspection, check status collection, merge decisions, branch protection
  evidence, and GraphQL review-thread operations.

Why it fits:

- GitHub docs recommend Octokit for JavaScript REST scripting.
- Octokit supports REST and GraphQL.
- It avoids building runtime behavior around shelling out to `gh`.

Reservations:

- Runtime auth must be injected only through the Credentials seam.
- Driver methods must return evidence records, not raw Octokit response shapes.
- Rate limiting, retries, pagination, and partial GraphQL response behavior must be modeled explicitly.

Required decision:

- Define the Forge evidence DTOs before adding Octokit so the SDK does not leak into core contracts.

### 6. Observability

Verdict: recommended with strict layering.

Candidates:

- OpenTelemetry API/SDK for traces and metrics export.
- Pino for structured process logs and redaction.

Where it fits:

- Edge and runner process telemetry.
- Driver instrumentation.
- Foundation logging adapter.
- Analysis export and operator diagnostics.

Why it fits:

- The requirements demand structured observability.
- OpenTelemetry is the industry-standard telemetry API/SDK family.
- Pino is a mature structured JSON logger with redaction support and strong Node adoption.

Critical boundary:

- Neither OpenTelemetry nor Pino replaces the event log.
- The event log remains the source of truth for run state.
- Logs/traces/metrics are operational views and correlation surfaces.

Required decision:

- Define `TelemetryPort` and `LoggerPort` boundaries before adopting either library.
- Core may emit domain events through an event writer, but should not call Pino or OpenTelemetry SDKs
  directly.
- All logs and telemetry must use credential and PII redaction rules owned by `fnd-04`.

### 7. Storage And Artifacts

Verdict: defer final storage library until the event-log and lease designs are locked.

Candidates:

- JSONL plus atomic file operations for first implementation.
- SQLite for indexed projections, leases, and richer querying if JSONL becomes fragile.
- `better-sqlite3` if a stable production SQLite library is needed.
- Node `node:sqlite` only after confirming stability for the project's Node target.

Evidence:

- Current Node docs describe `node:sqlite` as release-candidate level in the current stream; older
  Node 24-era docs and ecosystem notes have treated it as experimental. This should be rechecked at
  the exact Node version chosen for implementation.
- `better-sqlite3` is widely used and documented as a simple synchronous SQLite library with
  transaction support.

Reservations:

- Durable event append semantics, fsync policy, lock semantics, crash recovery, and tamper evidence
  are design requirements, not library features to assume.
- SQLite can simplify queries but complicates append-only event guarantees if not designed carefully.

Required decision:

- Decide whether v1 event storage starts as JSONL plus projection files, SQLite, or a two-layer model.
- Decide whether leases are file-lock based, SQLite-backed, or abstracted from day one.

### 8. CLI And Operator Surface

Verdict: evaluate later.

Candidates:

- `commander` for conventional CLI parsing.
- `clipanion` if stronger typed command composition is desired.
- Minimal custom parser if the CLI surface remains very small.

Where it fits:

- `edge-01` CLI entry surface.

Reservations:

- CLI framework choice should not influence core run logic.
- MCP and CLI should share application services, not duplicate orchestration.
- The CLI should remain a thin edge adapter.

Required decision:

- Define the edge command model first, then choose the smallest CLI library that fits.

### 9. State Machines And Workflow Modeling

Verdict: defer or use only as a modeling aid.

Candidate:

- `xstate`.

Where it may fit:

- Visualizing run lifecycle.
- Testing allowed transitions.
- Generating model-based test cases.

Why not adopt as default runtime now:

- The design already requires an append-only event log and pure projections.
- A hand-written reducer plus property tests may be simpler and more transparent.
- Actor runtime semantics could obscure the event-sourced control-plane model.

Required decision:

- Do not introduce XState into runtime core unless a spike proves it improves transition correctness
  without weakening replay determinism or event-log authority.

### 10. Full Application Frameworks

Verdict: avoid for core implementation.

Avoid as defaults:

- NestJS.
- Large decorator-based application frameworks.
- Frameworks that own module lifecycle, dependency injection, logging, and transport semantics.

Why:

- kit-vnext is a deterministic control plane with hard seams, not a conventional web service.
- Framework ownership of dependency injection and lifecycle can fight the worker/runner, event-log,
  and provider-contract boundaries.

Acceptable use:

- Future hosted service edge adapters may use a web framework if kept outside core and behind the
  edge boundary.

## Placement Matrix

| Library / class | Recommended placement | Forbidden placement |
|---|---|---|
| Awilix | Composition root, edge bootstrap, test graph assembly | Core, contracts, provider contract packages |
| Inversify | Not recommended by default | Core, contracts, shared domain packages |
| Zod | Config, event/artifact schema, provider evidence schemas | Unreviewed scattered utility schemas |
| fast-check | Unit, conformance, property tests | Runtime code |
| Execa | Execution Host local driver | Core, Forge, Work Source contracts |
| p-limit / p-queue | Foundation concurrency/admission helpers, drivers | Replacing durable leases or evented decisions |
| Octokit | GitHub Forge driver | Core, contracts, generic completion logic |
| OpenTelemetry SDK | Process bootstrap, edge, drivers, telemetry adapter | Domain reducers and pure core policies |
| Pino | Logger adapter, process logs, diagnostics | Event log source of truth |
| SQLite / better-sqlite3 | Storage implementation after design decision | Core logic and contracts |
| XState | Optional design/test model | Default runtime authority for run state |

## Required Fixes And Decisions Before Broad Implementation

1. Document dependency wiring policy.
   - Required before broad implementation planning.
   - Decide explicit injection only vs Awilix composition-root spike.
   - State that core cannot import DI containers or concrete SDKs.

2. Activate package/layer boundaries before adding runtime libraries.
   - Required before installing provider SDKs.
   - dependency-cruiser should fail if core imports drivers, SDKs, loggers, process runners, or
     network clients.

3. Choose the runtime schema strategy.
   - Required before config, events, provider evidence, and artifacts are implemented.
   - Recommended default: Zod v4, with JSON Schema output constrained to representable schema shapes.

4. Define provider conformance test harness dependencies.
   - Required before real driver work.
   - Recommended default: Vitest plus fast-check for adversarial and property tests.

5. Define process execution evidence before adopting Execa.
   - Required before `prov-04` local execution implementation.
   - The contract must include argv/cwd/env policy, output capture, timeout, signal, exit code,
     process-tree handling, and evidence refs.

6. Define Forge evidence DTOs before adopting Octokit.
   - Required before `prov-02` GitHub implementation.
   - Prevent raw SDK shapes from leaking into core.

7. Define observability boundaries.
   - Required before logging/telemetry implementation.
   - Event log remains source of truth; Pino/OpenTelemetry are operational telemetry adapters.

8. Decide initial storage backend.
   - Required before `fnd-02` implementation.
   - JSONL is the simplest first implementation; SQLite may be better once projection/query needs are
     clearer.

9. Define library acceptance criteria.
   - Required before dependency additions.
   - Every new library should have:
     - Intended package/layer placement.
     - Reason it reduces code or risk.
     - Contract boundary it sits behind.
     - Mock/test strategy.
     - Dependency-cruiser guard.
     - Security and observability implications.

## Optional Recommendations

1. Run a small Awilix spike only after package decomposition exists.
   - Goal: prove composition-root wiring for config, storage, mock providers, real providers, and edge
     commands.
   - Exit criterion: no core imports of Awilix; no service locator usage.

2. Add a dependency decision record template.
   - Use it for every runtime dependency addition.
   - Include layer, owner, source docs, threat model notes, testing plan, and removal plan.

3. Add a `docs/foundation/dependency-policy.md`.
   - It should translate the design invariants into implementation rules.
   - Include examples of allowed and forbidden imports.

4. Add a `docs/foundation/testing-policy.md`.
   - Define when unit, integration, conformance, smoke, property, and replay tests are required.

5. Keep CLI framework choice late.
   - The edge command model matters more than the parser library.

## Recommended Initial Dependency Set

Do not add all dependencies at once. Add them only with the domain that needs them.

First likely additions:

- `zod` for config/event/artifact schema work.
- `fast-check` and `@fast-check/vitest` for core invariants and conformance tests.

Likely later additions:

- `execa` when implementing the Execution Host local driver.
- `octokit` when implementing the GitHub Forge driver.
- `p-limit` when implementing bounded probe/analyzer concurrency.
- `pino` and OpenTelemetry packages when implementing observability adapters.

Conditional additions:

- `awilix` only if wiring duplication becomes real after packages exist.
- `better-sqlite3` only if storage design selects SQLite and Node built-in SQLite is not stable enough
  for the target runtime.
- `p-queue` only if simple concurrency limiting is insufficient.

Avoid for now:

- Inversify as default DI.
- NestJS or another broad application framework.
- XState as the runtime state authority.
- A framework that requires decorators across the domain model.

## Implementation Readiness Impact

These recommendations improve implementation readiness if they are converted into explicit design
rules before coding starts.

They reduce custom code in the right places:

- Zod reduces validation and schema drift.
- fast-check reduces manual edge-case test writing for invariants.
- Execa reduces command execution plumbing.
- Octokit reduces Forge API plumbing.
- Pino/OpenTelemetry reduce operational telemetry plumbing.
- p-limit/p-queue reduce queue/concurrency boilerplate.

They do not replace core design work:

- Capability attestation still needs contract design and probes.
- The event log still needs append, projection, replay, and recovery semantics.
- Provider conformance still needs domain-owned assertions.
- Dependency Rule enforcement still needs active package rules.
- Credential isolation still needs scoped injection and redaction policy.

## Final Recommendation

Start implementation with explicit dependency injection and a small number of boundary-owned OSS
libraries. Avoid a broad framework. Keep the core boring, pure, and easy to construct in tests.

Use libraries to reduce boilerplate at the seams:

- Validate inputs and events.
- Execute processes.
- Call Forge APIs.
- Bound concurrency.
- Emit operational telemetry.
- Generate adversarial tests.

Do not use libraries to hide architecture:

- No service locator in core.
- No decorator metadata as a domain requirement.
- No SDK response shapes in contracts.
- No logging system as run-state authority.
- No process/network access outside provider/foundation boundaries.
