# Coverage report

This report verifies that every non-`__MACOSX` file from the supplied `design.zip` was mapped into this regenerated docs tree.

## Summary

| Check | Result |
|---|---:|
| Source files mapped | 414 / 414 |
| Source Markdown files | 53 |
| Source evidence/data files | 361 |
| Non-Markdown exact copies | 361 / 361 |
| Markdown exact copies | 31 / 53 |

Markdown files may differ from the source because links and stale reading-path references were updated for the restructured tree. Non-Markdown evidence/data files are copied into the corresponding provider evidence folders without content changes.

## Important corrections captured

- `CapabilityAttestation` ownership is moved to the SDK target, not testkit.
- Provider mocks and conformance belong in testkit and are test-only.
- Work Source status-write audit citation is pinned as task metadata only, not run truth.
- Launch coordination ordering is explicit.
- Protected-policy anti-gaming gate is explicit.
- Stale domain-reading references to `AGENTS.md` and `docs/kit-vnext` were corrected in normative docs. Historical provider evidence command transcripts retain their original command paths because they are evidence records.

## Full file map

The full source-to-target file map is in [`COVERAGE_REPORT.json`](COVERAGE_REPORT.json).
