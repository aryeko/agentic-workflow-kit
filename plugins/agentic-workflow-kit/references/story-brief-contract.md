# Story brief contract

A story brief is a lightweight delivery-contract artifact produced by `plan-delivery-track` for one
tracker row. It is stored under the track:

```text
<tracksDir>/<track>/stories/<ID>.md
```

Story briefs are not implementation-ready. They give `implement-next` enough context to create or
refine the detailed technical story spec under `<specsDir>` (default `docs/specs`), then create an
implementation plan under `<plansDir>` (default `docs/plans`), then code.

Every story brief must include this exact note:

```text
not implementation-ready; create a detailed technical story spec before plan/code
```

## Required sections

### PRD criteria

List the PRD acceptance-criteria IDs this story contributes to and the expected product outcome.

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

### Candidate surfaces

List likely files, modules, commands, routes, queries, prompts, events, components, migrations, or
tests. These are candidates, not final implementation instructions.

### Validation expectations

List expected verification layers and repo-configured gates that the detailed spec should turn into
specific commands and checks.

### Open technical questions

List questions that `implement-next` must resolve in the detailed technical story spec before
planning or code. Blocking questions must stay explicit.
