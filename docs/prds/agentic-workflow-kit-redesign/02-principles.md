← [Back to README](./README.md)

# Principles

- **P1 - Local-first trust.** Repo-local config, docs, trackers, artifacts, and transcripts are the
  source of truth for V1. No hosted service is required to adopt or operate the product.
- **P2 - Workflow steps are composable.** Users can define a PRD, design an HLD, plan a track, or
  launch runtime flows independently when they already have enough context from another source.
- **P3 - Contracts before autonomy.** Autonomous execution requires explicit contracts: config,
  tracker schema, story ownership, verification commands, PR policy, and stop conditions.
- **P4 - Configured autonomy, not hidden autonomy.** The runtime can implement, verify, open PRs,
  respond to review findings, merge, delete branches, and continue to the next story only when the
  repo policy allows it.
- **P5 - Evidence over prose.** Completion is based on durable evidence such as tracker state,
  commits, verification output, PR state, artifacts, and transcripts. Agent prose alone is not
  authoritative.
- **P6 - Recoverability is a product feature.** Ambiguous, stale, or contradictory state should
  stop in a diagnosable recovery state instead of relaunching blindly.
- **P7 - Observability is first-class.** Users must be able to see status, performance, budgets,
  transcripts, and behavior analysis for real runs.
- **P8 - Codex-first, provider-conscious.** V1 acceptance targets Codex concretely, while product
  concepts and runtime contracts must not prevent future Claude or other host adapters.

---
Previous: [01-context](./01-context.md) · Next: [03-domain-model](./03-domain-model.md) · Up: [README](./README.md)
