# LangSmith
## What it is

LangSmith is LangChain's commercial platform for building, observing, evaluating, and, when using LangSmith Deployment, deploying LLM applications and agents. The LangChain organization profile positions it as the commercial platform for "building and monitoring production-grade LLM applications," alongside OSS LangChain, LangGraph, Deep Agents, MCP adapters, and Agent Protocol ([LangChain profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)). The current LangSmith docs frame the core product around observability, evaluation, prompt engineering, deployment, and operational tooling rather than as a standalone agent framework ([LangSmith Observability](https://docs.langchain.com/langsmith/observability), [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)).

## Core capabilities

Core capabilities are trace capture and inspection, production monitoring, dashboards and alerts, automations, feedback collection, annotation queues, offline and online evaluations, prompt management/versioning, API/SDK access, CLI access, and optional managed/self-hosted deployment for LangGraph-style agents ([Observability](https://docs.langchain.com/langsmith/observability), [Evaluation](https://docs.langchain.com/langsmith/evaluation), [Prompt engineering concepts](https://docs.langchain.com/langsmith/prompt-engineering-concepts), [LangSmith CLI](https://docs.langchain.com/langsmith/langsmith-cli), [Deployment](https://docs.langchain.com/langsmith/deployment)).

It supports framework integrations and manual instrumentation. Official docs list integrations across LangChain/LangGraph, OpenAI, Anthropic, CrewAI, AutoGen, Microsoft Agent Framework, Semantic Kernel, PydanticAI, Vercel AI SDK, and generic OpenTelemetry-compatible applications ([Observability concepts](https://docs.langchain.com/langsmith/observability-concepts), [Trace with OpenTelemetry](https://docs.langchain.com/langsmith/trace-with-opentelemetry)).

## How it works architecturally

For observability, LangSmith ingests traces into projects. A trace represents one operation and is made of runs/spans; runs can represent LLM calls, chains, tools, retrievers, prompt formatting, or arbitrary work. Multi-turn conversations are modeled as threads by linking traces with `session_id`, `thread_id`, or `conversation_id` metadata ([Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)).

Trace ingestion can happen through SDKs, automatic framework integrations, direct REST calls, or OpenTelemetry. The REST path creates and updates runs with `POST /runs` and `PATCH /runs`, while high-volume ingestion uses `POST /runs/multipart` and requires explicit `trace_id` and `dotted_order` hierarchy/order metadata ([Trace with API](https://docs.langchain.com/langsmith/trace-with-api)). The OTel path accepts standard OpenTelemetry spans plus LangSmith-specific attributes for trace/run IDs, parent IDs, project names, message events, tool calls, and attachments ([Trace with OpenTelemetry](https://docs.langchain.com/langsmith/trace-with-opentelemetry)).

For platform architecture, cloud-managed LangSmith consists of UI, backend API, platform backend, playground, and queue services. SaaS runs on GKE for GCP regions and EKS for the AWS US region; storage includes object storage for run inputs/outputs, PostgreSQL for transactional workloads, Redis for queuing/cache, and ClickHouse Cloud for trace ingestion and analytics ([Cloud architecture](https://docs.langchain.com/langsmith/cloud)). Self-hosting uses Kubernetes/Helm and backs the platform with PostgreSQL, Redis, ClickHouse, and optional blob storage ([Self-host LangSmith on Kubernetes](https://docs.langchain.com/langsmith/kubernetes)).

## Main abstractions / APIs

Primary observability abstractions are project, trace, run, thread, feedback, tags, and metadata ([Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)). Evaluation adds datasets, examples, experiments, evaluators, evaluator feedback, annotation queues, and assertions ([Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)). Prompt engineering adds prompt templates, commits, tags, Playground configurations, model settings, and tool definitions ([Prompt engineering concepts](https://docs.langchain.com/langsmith/prompt-engineering-concepts), [Use tools in a prompt](https://docs.langchain.com/langsmith/use-tools)).

Programmatic surfaces include Python, JS/TS, Go, and Java SDK references, a REST API, OpenTelemetry ingestion, and an alpha LangSmith CLI. The CLI is explicitly aimed at developers and AI coding agents and can query/manage projects, traces, runs, threads, datasets, examples, evaluators, experiments, and sandboxes with JSON output by default ([LangSmith CLI](https://docs.langchain.com/langsmith/langsmith-cli)). The SDK repository states that the Python and JavaScript SDKs interact with the LangSmith platform and support debugging, evaluation, and monitoring for any LLM application, with native LangChain integrations ([langsmith-sdk README](https://github.com/langchain-ai/langsmith-sdk)).

Deployment-specific abstractions are assistants, threads, runs, cron jobs, stores, MCP endpoints, and Agent Server APIs. Assistants are configured instances of deployed graphs, can have versions, and are specific to LangSmith Deployment rather than OSS LangGraph ([Agent Server](https://docs.langchain.com/langsmith/agent-server), [Assistants](https://docs.langchain.com/langsmith/assistants), [Agent Server API reference](https://docs.langchain.com/langsmith/server-api-ref)).

## Operational model

LangSmith can be consumed as SaaS, self-hosted, hybrid, or as standalone Agent Servers that still report traces to LangSmith. SaaS is fully managed by LangChain, including infrastructure, updates, scaling, UI/API/datastores, Agent Servers, and CI/CD for deployed apps ([Cloud](https://docs.langchain.com/langsmith/cloud)). Self-hosted mode runs in the user's infrastructure for observability, evaluation, prompt engineering, and optionally deployment ([Self-hosted LangSmith](https://docs.langchain.com/langsmith/self-hosted)).

The SaaS docs expose region-specific endpoints for US GCP, EU GCP, APAC GCP, and AWS US, plus documented rate limits by endpoint class. The operational posture is not only UI-driven: API keys, workspace headers, OAuth CLI profiles, JSON CLI output, webhook rules, bulk exports, and OTel collectors are all first-class operational surfaces ([Cloud](https://docs.langchain.com/langsmith/cloud), [LangSmith CLI](https://docs.langchain.com/langsmith/langsmith-cli), [Trace with API](https://docs.langchain.com/langsmith/trace-with-api), [Bulk export trace data](https://docs.langchain.com/langsmith/data-export)).

## Persistence / state / checkpointing model

For core observability, LangSmith persists trace/run data, feedback, datasets, experiments, prompts, and metadata. SaaS trace data retention is documented as 400 days from ingestion; datasets persist indefinitely even after the source trace expires ([Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)). Bulk export can write trace data to S3-compatible storage in Parquet format on supported plans ([Bulk export trace data](https://docs.langchain.com/langsmith/data-export)).

Application checkpointing is primarily a LangSmith Deployment / Agent Server concern, not a general observability feature. Agent Server deployments include graphs, a database for persistence, and a task queue; the API model includes assistants, threads, runs, cron jobs, and a persistent key-value store ([Agent Server](https://docs.langchain.com/langsmith/agent-server), [Agent Server API reference](https://docs.langchain.com/langsmith/server-api-ref)). The scaling docs state that Postgres stores runs, threads, assistants, cron jobs, checkpointing, and long-term memory, while Redis stores ephemeral data about ongoing runs and streaming between queue workers and API servers ([Agent Server scale](https://docs.langchain.com/langsmith/agent-server-scale)). I did not find primary-source evidence that LangSmith observability alone provides kit-like authoritative event sourcing or replay semantics.

## Observability / evaluation / debugging support

This is LangSmith's strongest match. It records trace trees, filters/query traces and runs, captures metadata/tags/feedback, supports dashboards and alerts, and provides UI/API/CLI access for inspecting errors, latency, token usage, and trace hierarchy ([Observability](https://docs.langchain.com/langsmith/observability), [Trace query syntax](https://docs.langchain.com/langsmith/trace-query-syntax), [Query traces using the SDK](https://docs.langchain.com/langsmith/export-traces), [LangSmith CLI](https://docs.langchain.com/langsmith/langsmith-cli)).

Evaluation is split into offline and online modes. Offline evals run an application over datasets/examples for benchmarking, regression tests, unit tests, and backtesting. Online evals score production runs or threads for real-time monitoring, anomaly detection, safety checks, format validation, quality heuristics, and reference-free LLM-as-judge feedback ([Evaluation](https://docs.langchain.com/langsmith/evaluation), [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)). Human review is supported through inline feedback, annotation queues, assertions, pairwise review, reviewer assignment/reservation, and exporting annotated runs into datasets ([Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts), [Log user feedback using the SDK](https://docs.langchain.com/langsmith/attach-user-feedback)).

## Provider / model / tool integration model

LangSmith is intentionally broad: it works through LangChain/LangGraph automatic tracing, direct SDK decorators/context managers/RunTree APIs, REST ingestion, and OTel. Official docs say integrations provide automatic tracing for frameworks and providers such as LangChain, LangGraph, OpenAI, Anthropic, and CrewAI; manual instrumentation is available for arbitrary code ([Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)). OpenTelemetry support is especially relevant because it gives a framework-neutral ingestion path and can fan out through an OTel collector ([Trace with OpenTelemetry](https://docs.langchain.com/langsmith/trace-with-opentelemetry), [Redact sensitive data with the OpenTelemetry Gateway architecture](https://docs.langchain.com/langsmith/otel-gateway-trace-redaction)).

Prompt tooling includes provider model settings, structured outputs, and custom tools in the Playground. Custom tools can be saved into a workspace-wide tool registry, while prompt templates can be versioned and pulled into application code by commit hash or tag ([Use tools in a prompt](https://docs.langchain.com/langsmith/use-tools), [Manage prompts programmatically](https://docs.langchain.com/langsmith/manage-prompts-programmatically)).

## Maturity and ecosystem notes

LangSmith is a central commercial product in the LangChain ecosystem, with official docs spanning observability, evaluation, prompt engineering, deployment, SaaS, self-hosting, API references, and operational controls. The `langsmith-sdk` repository is active; GitHub listed release `v0.8.18` on 2026-06-19 and showed 933 stars, 254 forks, 110 issues, and 59 pull requests when checked on 2026-06-21 ([langsmith-sdk releases](https://github.com/langchain-ai/langsmith-sdk/releases), [langsmith-sdk repo](https://github.com/langchain-ai/langsmith-sdk)).

Some surfaces are still maturing. The CLI is explicitly marked alpha, with commands, flags, and output schemas subject to change ([LangSmith CLI](https://docs.langchain.com/langsmith/langsmith-cli)). Recent SDK releases show continuing churn around OpenAPI client generation, online evals, sandbox helpers, backend minimum-version warnings, and dependency/security bumps ([langsmith-sdk releases](https://github.com/langchain-ai/langsmith-sdk/releases)). That activity is positive for ecosystem health but argues against treating every CLI/schema detail as stable.

## What looks relevant to kit-vnext

LangSmith is most relevant as an observability/evaluation reference, not as a replacement control plane. Its project/trace/run/thread/feedback model is a practical pattern for making agent behavior inspectable, queryable, and reviewable through UI, API, SDK, CLI, and exports. The OTel path is particularly relevant to kit-vnext's provider-neutral seams because it separates trace emission from a specific agent framework while preserving structured span hierarchies, metadata, errors, tool calls, attachments, and cross-service context.

The offline/online evaluation split maps well to kit-vnext's need for runner-owned verification plus production-style analysis: curated regression datasets, production trace sampling, evaluator feedback, annotation queues, and promotion of real failures into future test cases are all useful ideas. The CLI's JSON-first design for "AI coding agents" is also directly relevant to kit-vnext's operator/analysis surfaces.

Deployment and Agent Server are useful as comparative material for managed agents: assistants as versioned graph configurations, threads as stateful execution cursors, runs as workloads, Postgres-backed checkpoints, Redis-backed ephemeral streaming, and standalone data-plane operation all provide concrete prior art. They should remain comparative because kit-vnext's design requires worker/runner isolation, Forge credential boundaries, Work Source authority, and event-log authority that LangSmith does not appear to model as first-class constraints.

## What looks irrelevant or risky for kit-vnext

LangSmith observability is trace/span-centric, while kit-vnext is event-log-centric. A trace tree is excellent evidence, but it should not become the authoritative state machine for run lifecycle, approvals, merge gates, Work Source status, or capability attestations. The documented trace model also has SaaS retention limits, rate limits, and platform-owned storage, which may conflict with kit-vnext's need for durable local evidence and deterministic replay.

LangSmith Deployment is agent-application infrastructure, not a software-delivery control plane. Its Agent Server can run assistants, threads, cron jobs, and graph workloads, but the primary sources I found do not show runner/worker credential separation, Forge-specific evidence gates, Work Source status authority, or fail-closed capability attestation comparable to kit-vnext's invariants. Adopting it wholesale would risk coupling the core to LangChain/LangGraph deployment semantics.

Operationally, LangSmith introduces external service dependency, API keys, workspace/region configuration, data retention policies, rate limits, and possible plan restrictions for exports or private connectivity. Prompt Hub/public prompts are explicitly user-generated and unverified, so any prompt/tool reuse would need independent review rather than trust by provenance alone ([Manage prompts](https://docs.langchain.com/langsmith/manage-prompts)).

## Primary sources

- [LangChain organization profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [LangSmith Observability](https://docs.langchain.com/langsmith/observability)
- [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)
- [Trace with API](https://docs.langchain.com/langsmith/trace-with-api)
- [Trace with OpenTelemetry](https://docs.langchain.com/langsmith/trace-with-opentelemetry)
- [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
- [Set up automation rules](https://docs.langchain.com/langsmith/rules)
- [Prompt engineering concepts](https://docs.langchain.com/langsmith/prompt-engineering-concepts)
- [Manage prompts programmatically](https://docs.langchain.com/langsmith/manage-prompts-programmatically)
- [Use tools in a prompt](https://docs.langchain.com/langsmith/use-tools)
- [LangSmith Cloud architecture](https://docs.langchain.com/langsmith/cloud)
- [Self-hosted LangSmith](https://docs.langchain.com/langsmith/self-hosted)
- [Self-host LangSmith on Kubernetes](https://docs.langchain.com/langsmith/kubernetes)
- [Agent Server](https://docs.langchain.com/langsmith/agent-server)
- [Agent Server scale](https://docs.langchain.com/langsmith/agent-server-scale)
- [Agent Server API reference](https://docs.langchain.com/langsmith/server-api-ref)
- [Assistants](https://docs.langchain.com/langsmith/assistants)
- [LangSmith CLI](https://docs.langchain.com/langsmith/langsmith-cli)
- [Bulk export trace data](https://docs.langchain.com/langsmith/data-export)
- [langchain-ai/langsmith-sdk](https://github.com/langchain-ai/langsmith-sdk)
- [langsmith-sdk releases](https://github.com/langchain-ai/langsmith-sdk/releases)
