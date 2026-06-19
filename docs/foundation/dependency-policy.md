# Dependency Policy

This policy turns the architecture Dependency Rule into implementation rules for
package dependencies, third-party libraries, dependency injection, determinism,
schema ownership, and SDK placement.

Ground truth for package names and enforced library bans is
[`docs/implementation/package-map.md`](../implementation/package-map.md) and
[`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs). This document must
not be looser than those rules.

## Dependency Rule

All package dependencies must follow the architecture:

> Edge -> Control plane -> Contracts. Drivers -> Contracts. Everything ->
> Foundation. Nothing depends on a concrete driver. Contracts never depend on
> the core.

The package name is the boundary. Do not create ad hoc shared packages or move a
library to a different layer to make an import convenient. If an implementation
needs a new boundary, raise a design change before coding it.

## Layer Placement

| Layer | Package pattern | May depend on | Must not depend on |
|---|---|---|---|
| Foundation | `@kit-vnext/foundation-*` | Foundation peers | Contracts, core, edge, drivers, composition root |
| Contracts | `@kit-vnext/contracts-*` | Foundation, sibling contracts | Core, edge, drivers, composition root |
| Control plane | `@kit-vnext/core-*` | Foundation, contracts, sibling core packages allowed by design | Edge, drivers, composition root |
| Drivers | `@kit-vnext/drivers-*` | Foundation, contracts | Core, edge, composition root, peer drivers |
| Edge | `@kit-vnext/edge-*` | Foundation, contracts, core | Drivers, composition root |
| Conformance kit | `@kit-vnext/conformance-kit` | Test-only contracts, drivers, foundation as needed | Production runtime imports |
| Composition root | `@kit-vnext/composition-root` | Runtime graph assembly dependencies | Business logic ownership |

Production packages and tooling must not import test fixtures,
`__tests__`, `test-helpers`, or `@kit-vnext/conformance-kit` except from tests
or conformance-only code.

## External Library Placement Matrix

These entries must match the committed dependency-cruiser package-name bans.

| SDK / package family | Only allowed in | Rule |
|---|---|---|
| `octokit`, `@octokit/*` | `packages/drivers-github` | GitHub SDKs stay behind the Forge driver seam. |
| `execa`, `native-containment-helper`, `@kit-vnext/native-containment-helper` | `packages/drivers-local` | Process spawning and native containment helpers stay behind the Local Execution Host driver seam. |
| `pino`, `@opentelemetry/*` | `packages/edge-01`, `packages/foundation-fnd-04` | Telemetry SDKs stay at the operator edge or the foundation telemetry adapter boundary. |
| `awilix` | `packages/composition-root` | A container, if ever used, is runtime assembly only. |
| `node:sqlite`, `sqlite`, `sqlite3`, `better-sqlite3`, `libsql`, `@sqlite.org/sqlite-wasm`, `@libsql/client` | `packages/foundation-fnd-02` | SQLite and SQLite-compatible storage clients stay inside the storage package. |

Any library not listed still needs the acceptance checklist below. Absence from
the matrix is not permission to import it anywhere.

## Injection Policy

Use explicit constructor or factory injection for dependencies. A module should
receive the ports, collaborators, and configuration it needs as typed arguments.
This keeps the control plane replayable, testable, and free of hidden ambient
state.

No dependency injection container is allowed in foundation, contracts, core,
drivers, edge, or conformance packages. If a container is ever justified,
`awilix` may only appear in `packages/composition-root`, and only to assemble the
runtime graph. Container registrations must not leak into core APIs, contract
types, drivers, tests, or package internals.

## Determinism Ports

Clock, id generation, and randomness are injected ports. Do not call
`Date.now`, `new Date()`, `crypto.randomUUID`, `Math.random`, or equivalent
ambient sources from deterministic core decision logic. Pass a clock, id
factory, or randomness source through the relevant constructor or factory.

This is a determinism requirement, not a style preference. Replay, projection,
capability gating, and recovery logic must be pure over recorded inputs and
injected deterministic services.

## Result Discipline

Core decision functions should return typed outcomes instead of silently
throwing or collapsing failures into prose. Use a local discriminated union as
the default:

```ts
type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
```

Do not add a Result library by default. Revisit the default only when duplicate
helpers or ergonomics become real implementation friction, and only after the
candidate library passes the per-library acceptance checklist. The accepted
library must not weaken typed failure modeling or introduce a dependency-rule
violation.

Throwing is reserved for programmer errors, impossible states after exhaustive
checks, or boundary failures that are immediately caught and converted to a
typed error at the system boundary.

## Schema Ownership

Schema ownership follows the boundary that owns the data:

| Schema kind | Owner | Rule |
|---|---|---|
| Seam payloads | Contract package | Contract-owned and imported by core, drivers, and conformance tests. Must be JSON-Schema-representable, including through Zod `toJSONSchema` if Zod is used. |
| Config, policy, event envelope, artifacts | Foundation package | Foundation-owned because all layers may need to validate or persist them. |
| Evidence, probes, provider raw observations | Driver package | Driver-owned until mapped into contract DTOs or foundation artifacts. |

No SDK response type, provider object, or driver-owned raw evidence shape may
cross a seam. Drivers validate and map provider data into contract-owned DTOs.

## Per-Library Acceptance Checklist

Before adding any library, document the decision in the owning work item or
design artifact:

- **Placement:** the package that will own the import and the layer rule that
  allows it.
- **Value:** why the library reduces code, risk, or operational complexity.
- **Boundary:** the seam, adapter, or foundation boundary that contains it.
- **Types:** whether external types cross package boundaries; default is no for
  SDKs and provider clients.
- **Tests:** the unit, integration, conformance, or smoke strategy that proves
  correct behavior without trusting the library blindly.
- **Depcruise guard:** whether an existing rule enforces the placement or a new
  rule is needed.
- **Security:** credential handling, redaction, supply-chain, and input
  validation implications.
- **Observability:** logs, telemetry, error shape, and failure-mode impact.

If the checklist cannot be completed, do not add the dependency.

## SDK Behind A Seam: Octokit

Octokit is the model for SDK placement. `octokit` and `@octokit/*` may only be
imported by `packages/drivers-github`. The GitHub driver may use both REST and
GraphQL APIs internally, but SDK objects and SDK types die at the driver
boundary.

The driver must:

- receive GitHub tokens through the Credentials and Secrets foundation boundary;
- redact tokens and private identifiers in logs and telemetry;
- map REST and GraphQL responses into contract-owned Forge DTOs;
- validate seam payloads through schema-pinned conformance tests;
- capture provider evidence as driver-owned evidence until it is mapped;
- fail closed when evidence is missing, stale, malformed, or contradicted.

Core packages consume the Forge contract. They never import Octokit, GitHub
types, or provider-specific evidence structures.
