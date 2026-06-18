# Detailed technical story spec contract

When `implement-next` claims a story brief (`status: specced`), it enriches the same story file in
place — appending the implementation-ready sections below — rather than creating a separate document.
The story file is located at:

```text
<tracksDir>/<track>/stories/<ID>.md
```

Enrichment is a file-content operation. The tracker row status does NOT change during enrichment:
it stays at `statuses.inProgress` (`implementing`) through enrichment, planning, implementation,
and completion. The `plan-approved` tracker status is a valid eligible (pre-claim) status that
exists when a story has been enriched by a separate planning pass but not yet claimed for
implementation. `implement-next` never reverts a claimed row from `implementing` to `plan-approved`.

After enrichment the story file is implementation-ready. The brief-level note in the file —
"not implementation-ready until enriched to plan-approved" — refers to file maturity, not tracker
status. Once enriched, the file has passed that maturity threshold regardless of the tracker status.

`paths.specsDir` (default `docs/specs`) is retained for backward compatibility. Existing trackers
that already link a separate detailed spec directly remain valid; `implement-next` continues the
legacy behavior for those rows. New trackers use the grow-in-place model.

## Sections appended in place by `implement-next`

The following sections are appended to the story file during enrichment. Together they constitute the
implementation-ready state.

### Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| `<question from brief>` | `<decision>` | `<why this is safe>` |

### Exact types/contracts

Define exact exported types, interfaces, API contracts, props, payloads, status values, or command
contracts.

### Exact files/modules

```text
<path>  <exact responsibility/change>
```

### Query/schema/prompt/event/component design

Describe exact query, schema, prompt, event, component, route, worker, or command behavior.

### Tests

List exact test files, scenarios, fixtures, and focused commands.

### Migration/deploy concerns

List migrations, backfills, feature flags, rollout order, rollback, and deploy compatibility.

### Blocking technical questions

This section must say `None` before an implementation plan or code may be written.
