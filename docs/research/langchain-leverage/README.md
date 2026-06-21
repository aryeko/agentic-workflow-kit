# LangChain leverage report

## TLDR

This second-pass review asks where kit-vnext can gain concrete implementation leverage from the
LangChain ecosystem, rather than only asking whether adoption is safe.

Best answer: use LangChain ecosystem projects aggressively as source-level prior art, fixtures, and
optional provider-side spike inputs. Do not put them in the deterministic core or make them
authoritative for run state, approval, completion, merge, recovery, or capability truth.

Highest near-term leverage:

- MCP adapter patterns for tool/session/content/failure fixtures.
- LangGraph interrupt, checkpoint, replay, and stale-state concepts as core/testkit fixtures.
- LangSmith trace/eval/feedback vocabulary for `core-07` report and eval stories.
- Open SWE and Deep Agents Code operational patterns for later provider-driver fixtures.
- LangChain.js, Deep Agents.js, and Agent Protocol as post-seam `AgentProvider` adapter spikes.

## Task

The task was to create a source-fit report that optimizes for implementation savings. It starts from
the committed first-pass review in `design-closure/outputs/langchain-review/`, rechecks current
upstream primary sources, and evaluates five leverage areas:

- `AgentProvider` acceleration.
- Durable execution and tests.
- Observability and evals.
- Coding-agent operations.
- Tool and MCP adapter patterns.

## Method

The review used source-level fit analysis, not prototype code. Each opportunity was scored for code
avoided, product gain, seam fit, invariant risk, dependency risk, timing, and recommended use type.

The fit target was kit-vnext's applied design closure:

- SDK-owned provider ports.
- Testkit mocks and conformance before real drivers.
- `CapabilityAttestation` as the live-power gate.
- Event log as run-activity source of truth.
- Worker/runner isolation.
- Real drivers as production-readiness work.

## Report map

- [Leverage report](LEVERAGE-REPORT.md)
- [Sources](SOURCES.md)
- [AgentProvider acceleration](opportunities/agent-provider-acceleration.md)
- [Durable execution and tests](opportunities/durable-execution-tests.md)
- [Observability and evals](opportunities/observability-evals.md)
- [Coding-agent operations](opportunities/coding-agent-operations.md)
- [Tool and MCP adapter patterns](opportunities/tool-mcp-adapters.md)

## References

- [First-pass LangChain ecosystem review](../langchain-review/README.md)
- [Applied design closure report](../apply/APPLY-REPORT.md)
- [SDK provider ports](../../../docs/design/20-sdk-and-packaging/provider-ports.md)
- Domain DAG
- Readiness matrix

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../README.md) · **← Prev:** [Tool and MCP adapter patterns](./opportunities/tool-mcp-adapters.md) · **Next →:** [LangChain leverage report for kit-vnext](./LEVERAGE-REPORT.md)

**Children:** [LangChain leverage report for kit-vnext](./LEVERAGE-REPORT.md) · [LangChain leverage sources](./SOURCES.md) · [AgentProvider acceleration](./opportunities/agent-provider-acceleration.md) · [Durable execution and tests](./opportunities/durable-execution-tests.md) · [Observability and evals](./opportunities/observability-evals.md) · [Coding-agent operations](./opportunities/coding-agent-operations.md) · [Tool and MCP adapter patterns](./opportunities/tool-mcp-adapters.md)

<!-- /DOCS-NAV -->
