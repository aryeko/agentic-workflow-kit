# Quality review

This review was generated after rebuilding the docs tree from the supplied `design.zip`.

## Result

The regenerated docs are now lossless for the current design corpus and organized around reader intent.

## Verification checks

| Check | Result |
|---|---:|
| Total files in generated docs | 456 |
| Markdown files | 94 |
| Source files mapped | 414/414 |
| Excluded implementation/reviews/history folders present | none |
| Broken Markdown local links | 0 |
| Unbalanced code fences | 0 |
| Mermaid diagrams | 57 |
| Missing mapped targets | 0 |
| Non-Markdown evidence files changed | 0 |
| Markdown files over 400 lines | 0 |
| Stale normative path patterns | 0 |

Full machine-readable output is in [`verification-report.json`](verification-report.json).

## Manual review notes

- The high-level reader path starts at `docs/README.md`, then descends into orientation, architecture, SDK/packaging, and domain reference.
- The full current design corpus is preserved under `docs/design/30-domain-reference/` and supporting orientation/architecture/decision files.
- Provider evidence artifacts are copied into their corresponding provider reference folders.
- Normative docs capture the review fixes:
  - SDK-centered packaging target.
  - SDK-owned provider interfaces.
  - SDK-owned `CapabilityAttestation`.
  - Testkit-only mocks and conformance.
  - Work Source task-status audit citation decision.
  - Explicit launch coordination flow.
  - Protected-policy anti-gaming gate.
  - Simplified dependency rules for the new package model.
- Historical command paths inside provider evidence files are intentionally retained because those files are evidence transcripts, not normative reading paths.

## Caveat

Markdown source files are not byte-for-byte identical when links or stale reading-path references needed correction. The coverage report records this. Evidence and data files are exact copies.
