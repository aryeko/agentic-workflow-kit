# OpenAI Codex ExecPlans source note

## Source and access metadata

- Source: [Using PLANS.md for multi-hour problem solving](https://developers.openai.com/cookbook/articles/codex_exec_plans).
- Publisher surface: OpenAI Developers Cookbook.
- Article date shown by source: 2025-10-07.
- Accessed: 2026-06-22.
- Scope used here: living execution plans for long Codex tasks, including plan
  authoring, progress tracking, decision capture, validation, evidence snippets,
  milestone structure, recovery, and handoff after context loss.

## Main guidelines

- Put the planning convention in repository instructions first. The article uses
  `AGENTS.md` to teach Codex when a long-running task should use a plan and what
  shorthand term identifies that plan.
- Treat the plan as an executable specification, not a preface. It should tell a
  future agent or human what to build, why it matters, how to navigate the repo,
  what files and commands matter, and how to prove success.
- Make the plan self-contained. The intended reader has the current tree and the
  plan file, but no chat history, no prior plan memory, and no implicit repository
  lore.
- Keep the plan live. The plan is updated as implementation proceeds, as facts
  are discovered, as decisions are made, and as milestones complete.
- Lead with purpose and observable behavior. The plan should explain what a user
  can do after the change and how to see that behavior working.
- Define terms in plain language. If a plan uses repo-specific jargon or technical
  vocabulary, it should define the term and point to the files or commands where
  the concept appears.
- State repository context directly. Name paths, functions, modules, commands,
  working directories, assumptions, and environment prerequisites instead of
  relying on the reader to infer them.
- Use independently verifiable milestones. Each milestone should have a goal,
  work to perform, result, commands to run, and acceptance evidence.
- Distinguish milestones from progress. Milestones tell the implementation story;
  progress is a granular checklist that records actual current state at stopping
  points.
- Include mandatory living sections: progress, surprises and discoveries,
  decision log, outcomes and retrospective.
- Validate through behavior, not just compilation. The plan should describe tests,
  system startup or exercise steps, expected output, and how to interpret failure.
- Capture concise evidence. Terminal output, logs, diffs, or traces should be
  included only when they prove progress or success.
- Make steps idempotent and recoverable. Risky or destructive operations need a
  safe retry, rollback, or cleanup story.
- Use prototypes and spikes to de-risk uncertain designs. The article encourages
  small, additive experiments when feasibility, library behavior, or composition
  order is unknown.
- Keep interface and dependency expectations concrete. A good plan names the
  modules, libraries, services, types, traits, interfaces, or function signatures
  expected at the end.

## Assumptions and operating model

- The agent can inspect the repository, search files, run tests, run commands, and
  edit code, but it does not retain reliable memory outside the current context.
- The user can inspect the plan before a long implementation starts and use it to
  steer or reject the approach.
- The plan is the restart artifact. A future agent should be able to resume from
  the plan alone after context compaction, process loss, or handoff.
- During implementation, the agent should keep moving through the next milestone
  rather than repeatedly asking the user for generic next steps.
- Ambiguity should be resolved in the plan itself, with the reason recorded.
- Discoveries are expected. Unexpected optimizer behavior, performance tradeoffs,
  bugs, or unapply/reversal semantics should update the plan rather than living
  only in chat.
- Prototypes are first-class milestones when they reduce risk. They should be
  additive, testable, clearly scoped, and tied to promotion or discard criteria.
- The article assumes a single stateless agent can use the plan effectively. It
  does not define a multi-worker control plane, scheduler, event log, or merge
  authority.

## Failure modes and anti-patterns

- Undefined jargon: using terms like service, daemon, gateway, adapter, or
  provider without explaining what they mean in this repository.
- Hidden context: saying "as discussed earlier" or pointing to external material
  without embedding the needed context in the plan.
- Letter-only implementation: producing code that satisfies a narrow textual
  requirement but does not create useful observable behavior.
- Outsourced decisions: leaving unresolved choices for the next reader instead of
  selecting a path and explaining why.
- Internal-only acceptance: claiming success because a type, class, or helper was
  added, without showing how the behavior can be observed.
- Vague commands: omitting working directory, exact command line, expected output,
  or interpretation of test failures.
- Stale progress: failing to split partially done work into completed and
  remaining pieces at stopping points.
- Missing decision history: changing direction without recording the decision,
  rationale, date, and author.
- Unsafe repetition: steps that drift, duplicate, or destroy state when rerun.
- Over-large artifacts: pasting large patches or transcripts instead of concise,
  file-scoped evidence that proves the point.
- Compressed milestones: shortening a milestone until future implementers lose
  critical context.
- Plan drift: updating one section while leaving progress, decisions, validation,
  and retrospective inconsistent.

## Practices worth copying

- A repository-owned planning contract similar to `PLANS.md`, referenced from
  `AGENTS.md`, for tasks that exceed a short edit-review loop.
- A canonical implementation-plan skeleton with explicit sections for purpose,
  progress, discoveries, decisions, outcomes, context, plan of work, concrete
  steps, validation, idempotence, artifacts, and interfaces.
- Timestamped progress entries that can survive compaction and show work rate.
- A decision log that records not only the choice but also why the choice was
  made and who made it.
- A surprises-and-discoveries section that captures evidence-backed learning,
  especially when test output, logs, or prototypes changed the plan.
- Milestones that each end in a demonstrable behavior or evidence-producing
  command.
- Validation text that tells a novice what success and failure look like.
- Evidence snippets that are short enough to review yet concrete enough to
  support later audit.
- Explicit idempotence and recovery notes for commands, migrations, cleanup, and
  rollback.
- Additive spikes and parallel implementations where they keep the system working
  while risk is retired.
- A final outcomes and retrospective section comparing the delivered result
  against the original purpose and listing remaining work.

## Relevance to kit-vnext

- Strong fit: kit-vnext already treats agents as bounded workers and requires
  evidence over prose. ExecPlan-style documents strengthen the human-readable
  side of that model by making worker intent, progress, decisions, and validation
  inspectable before and during long runs.
- Important distinction: in kit-vnext, a living plan should not become the
  authority for run state. The event log remains the source of truth; a plan is a
  resumable explanation and handoff artifact that should be reconciled against
  recorded events and runner-owned evidence.
- The article's progress checklist maps well to kit-vnext supervision, but the
  kit should prefer progress events or artifacts that can be checked mechanically
  rather than relying only on Markdown checkboxes.
- The decision-log requirement fits kit-vnext human-supervised autonomy. Decisions
  that affect scope, risk, credentials, merge policy, or protected behavior should
  be explicit and auditable, not buried in chat.
- The validation guidance reinforces kit-vnext's verify gate: the worker's plan
  should say what proof is expected, while the runner captures independent command
  output and external Forge evidence.
- The evidence-snippet guidance is useful for durable research and runbooks, but
  kit-vnext should avoid copying bulky logs into plans when artifact references
  can preserve the raw evidence more cleanly.
- The compaction-resilient stance is directly relevant to worker recovery. A
  worker restart should be able to rehydrate task intent from the plan and
  authoritative status from the event log without needing chat history.
- The prototype milestone pattern is useful for uncertain provider, execution
  host, or forge-driver work. Spikes should be additive, scoped, and retired or
  promoted with evidence.
- The idempotence and recovery section aligns with kit-vnext's recovery and
  reconciliation design: every long-running task should describe safe retry,
  cleanup, and rollback behavior before risky steps execute.
- The article's novice-reader framing is valuable for kit-vnext story contracts:
  a plan should be clear enough for a fresh worker, reviewer, or human maintainer
  to understand the intended behavior and the proof required.

## Source-backed caveats

- The article presents one prompting approach, not a Codex product guarantee or a
  full orchestration specification.
- `ExecPlan` is an arbitrary shorthand taught through repository instructions; it
  should not be treated as a native Codex primitive.
- The included plan format is intentionally customizable. kit-vnext should adapt
  the structure to its design corpus, event-log model, and story-contract shape
  rather than copying the template wholesale.
- The article's instruction to proceed autonomously and commit frequently must be
  bounded by kit-vnext's worker/runner split: workers may implement and commit
  locally, while credentialed push, PR, verification, and merge remain runner
  responsibilities.
- The single-plan-file model does not by itself solve multi-agent coordination,
  duplicate launch prevention, capability attestation, protected policy changes,
  or exact-head merge evidence. Those remain kit-vnext control-plane concerns.
- The article's evidence examples are human-readable snippets. kit-vnext needs
  both human-readable summaries and durable artifact references suitable for
  gates, replay, and audit.
- Because the source is about long Codex tasks, its strongest lessons apply to
  substantial features, refactors, migrations, and uncertain research. It should
  not force heavyweight plans onto trivial edits.
