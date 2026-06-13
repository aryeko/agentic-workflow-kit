← [Back to README](./README.md)

# Context

## The problem

Agentic coding tools can write code, review diffs, run commands, and open PRs, but teams still lack
a durable operating model for turning product intent into safe, repeatable delivery. In practice,
users bounce between ad hoc prompts, scattered plans, local shell state, PR comments, CI logs, and
conversation transcripts. The result is powerful but fragile automation: unclear scope, inconsistent
handoffs, weak recovery, limited observability, and no reliable way to know what an autonomous run
actually did or why it stopped.

The pain is strongest when a team wants more than a single coding prompt. A real feature needs
product framing, high-level design, backlog slicing, story ownership, verification, review,
merge policy, and operational evidence. Without a shared contract, each agent session reinvents the
workflow.

## The opportunity

agentic-workflow-kit can become the local-first delivery layer for AI-assisted software work. It can
give users tested workflow skills, repo-local contracts, and a runtime that lets agentic tools move
from intent to PRs while preserving human control, evidence, and recovery paths.

The product opportunity is not to replace developers or project management systems. It is to make
agentic development workflows predictable enough that users can safely delegate bounded feature work
and inspect the outcome.

## Product thesis

Teams will trust autonomous coding loops when the workflow is explicit, configurable, observable,
and recoverable. agentic-workflow-kit should provide that workflow as local repo infrastructure:
PRD to HLD, HLD to contract-backed track, track to story or track autopilot, and autopilot to
verified GitHub PRs.

## Non-goals

| Non-goal | Status |
| --- | --- |
| Hosted dashboard or shared backend | deferred |
| General-purpose business-process agent platform | out for V1 |
| Arbitrary backlog execution without migration to the tracker contract | out |
| First-class non-GitHub collaboration targets | deferred |
| TUI, local dashboard, or MCP app management surface | deferred |
| Full evaluation and benchmarking harness | deferred |
| Replacing CI, review, or GitHub policy | out |

---
Previous: — · Next: [02-principles](./02-principles.md) · Up: [README](./README.md)
