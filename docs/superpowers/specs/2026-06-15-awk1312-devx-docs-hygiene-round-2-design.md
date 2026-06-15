---
title: AWK1312 detailed technical story spec
owner: codex-2026-06-15T20-06-34Z
last-reviewed: 2026-06-15
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1312.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-2.md
  - ../../tracks/agentic-workflow-kit-redesign/release-readiness-review-2.md
---

# AWK1312 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK1312.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Contact address for CoC and security disclosure? | Use `aryekogan@gmail.com` for Code of Conduct enforcement reporting. | The maintainer explicitly supplied this address for the CoC contact. `SECURITY.md` already owns security disclosure via GitHub private advisories, so this story updates only the conduct-reporting path. |
| Is a single-owner CODEOWNERS acceptable? | Yes: use `* @aryeko`. | The brief and release-hardening design both state a single-owner default is acceptable for the current maintainer set. |
| Should this story change code or runtime config? | No. | The brief marks code and config changes out of scope; acceptance is docs/DevX polish only. |
| Should all CamelCase `WorkflowKit` references be removed? | No: fix only the lone naming nit in canonical docs at `docs/architecture.md`; leave API envelope strings and historical package README wording unless separately scoped. | The story brief scopes the naming change to `docs/architecture.md:130`, and broader rewrites are out of scope. |

## Exact types/contracts

No TypeScript types, schemas, API envelopes, MCP tools, CLI commands, runtime events, or package
contracts change.

Persistent docs/DevX contracts for this story:

- `.github/CODEOWNERS` exists and uses GitHub CODEOWNERS syntax.
- Default ownership routes all repository files to `@aryeko`.
- `CODE_OF_CONDUCT.md` contains a direct conduct-reporting contact address and no longer uses the
  bare `@aryeko` handle as the enforcement contact.
- `docs/architecture.md` uses `agentic-workflow-kit API envelope` for the `workflow_project_inspect`
  row instead of the CamelCase `WorkflowKit API envelope` phrase.

## Exact files/modules

```text
.github/CODEOWNERS  Add repository-wide default owner: * @aryeko.
CODE_OF_CONDUCT.md  Replace the enforcement-contact GitHub handle sentence with the supplied contact address.
docs/architecture.md  Normalize the `workflow_project_inspect` table row naming nit.
docs/tracks/agentic-workflow-kit-redesign/README.md  Track claim, spec link, plan link, done status, and PR link only.
docs/superpowers/specs/2026-06-15-awk1312-devx-docs-hygiene-round-2-design.md  Transient detailed spec; remove before final merge if durable content is fully canonical.
docs/superpowers/plans/2026-06-15-awk1312-devx-docs-hygiene-round-2.md  Transient implementation plan; remove before final merge if durable content is fully canonical.
```

## Query/schema/prompt/event/component design

No query, schema, prompt, event, component, route, or migration design applies.

Docs behavior:

- CODEOWNERS should be minimal and valid:

  ```text
  * @aryeko
  ```

- CoC enforcement wording should point reporters to `aryekogan@gmail.com` and remove the placeholder
  sentence about substituting a dedicated private contact later.
- The architecture row should say "shared agentic-workflow-kit API envelope" to match the rest of
  the canonical docs.

## Tests

Focused verification:

- `test -f .github/CODEOWNERS`
- `grep -n '^\\* @aryeko$' .github/CODEOWNERS`
- `grep -n 'aryekogan@gmail.com' CODE_OF_CONDUCT.md`
- `! grep -n 'responsible for enforcement at \\[@aryeko\\]' CODE_OF_CONDUCT.md`
- `! grep -n 'WorkflowKit API envelope' docs/architecture.md`

Configured verification:

- `pnpm check`

## Migration/deploy concerns

None. This is a docs-only change with no runtime migration, npm package behavior, plugin metadata,
or deploy-order concern.

## Blocking technical questions

None
