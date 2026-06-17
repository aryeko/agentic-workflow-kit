# Detailed technical story spec contract

When `implement-next` claims a story brief (`status: specced`), it enriches the same story file in
place — appending the implementation-ready sections below — rather than creating a separate document.
The story file is located at:

```text
<tracksDir>/<track>/stories/<ID>.md
```

Once enriched, the tracker row advances to `plan-approved`, signalling that the story is
implementation-ready. The brief-level note becomes accurate: the story has been enriched to
`plan-approved` and the "not implementation-ready" note no longer applies.

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
