# Story brief contract

A story brief is the brief-level state of a grow-in-place story file produced by
`plan-delivery-track` for one tracker row. It is stored under the track:

```text
<tracksDir>/<track>/stories/<ID>.md
```

Story files grow in place: `plan-delivery-track` writes the brief-level sections; at pickup,
`implement-next` enriches the same file to implementation-ready by appending the implementation
sections. The tracker `status` column tracks maturity: `specced` = brief-level,
`plan-approved` = implementation-ready.

Every story file at brief-level (status `specced`) must include this exact note:

```text
brief-level — not implementation-ready until enriched to plan-approved
```

## Required sections

### PRD criteria

List the PRD acceptance-criteria IDs this story contributes to and the expected product outcome. If
planning from a technical solution alone or explicit backlog/design context without a PRD, use stable
context-derived outcome labels instead of inventing PRD IDs, and state the source document or
context for each label.

### Technical solution sections

List the technical solution headings or section IDs this story must preserve or instantiate. If no
technical solution was required, state why.

### Dependencies

List tracker dependencies, upstream story briefs, and any dependency-specific assumptions.

### Scope boundary

State what is in scope and out of scope for the story. This prevents the detailed spec from
silently expanding the story.

### Assumptions and blockers

List safe assumptions the detailed technical story spec may rely on, plus blocking questions that
must be resolved before planning or code. These blocking questions should mirror the final **Open
technical questions** table when they are implementation-level.

### Artifact boundaries

State the responsibilities this story must preserve: PRD owns what/why, technical solution owns
high-level how, tracker owns sequencing/status, story brief owns lightweight story-local scope,
detailed technical story spec owns exact implementation design, implementation plan owns execution
steps, and Runtime artifacts own execution evidence.

### Canonical impact

One line stating whether this story changes an invariant, introduces a decision, or changes product
behavior that the promote-to-canonical story must fold into canonical docs. Use `none` when the
story has no durable canonical impact.

### Candidate surfaces

List likely files, modules, commands, routes, queries, prompts, events, components, migrations, or
tests. These are candidates, not final implementation instructions.

### Validation expectations

List expected verification layers and repo-configured gates that the enriched story file must turn
into specific commands and checks.

### Open technical questions

List questions that `implement-next` must resolve when enriching this story to implementation-ready
before planning or code. Blocking questions must stay explicit.
