---
"@agentic-workflow-kit/orchestrator": minor
---

Rename the public planning skills to `define-product`, `design-technical-solution`, and
`plan-delivery-track`, and clarify the planning artifact flow from PRD to technical solution to
delivery tracker/story briefs before `implement-next` creates detailed specs, implementation plans,
and code.

Detailed specs and implementation plans are written to the configured `paths.specsDir` /
`paths.plansDir` (defaults `docs/specs` / `docs/plans`) rather than a hardcoded directory, keeping
per-repo locations declarative.

BREAKING: the `standalone-spec` and `delta-spec` templates are removed. New trackers link
lightweight story briefs instead. Existing trackers that link a detailed spec directly — including
legacy `see <ID> + [delta](path)` rows — remain valid and are read as the detailed spec by
`implement-next`.
