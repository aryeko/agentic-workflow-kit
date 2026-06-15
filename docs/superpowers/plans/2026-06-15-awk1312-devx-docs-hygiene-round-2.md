# AWK1312 implementation plan

## Scope

Docs/DevX hygiene only:

- Add `.github/CODEOWNERS` with repository-wide ownership routed to `@aryeko`.
- Replace the Code of Conduct enforcement contact handle with `aryekogan@gmail.com`.
- Normalize the `workflow_project_inspect` row in `docs/architecture.md` from "WorkflowKit API
  envelope" to "agentic-workflow-kit API envelope".
- Verify the targeted text changes and run `pnpm check`.
- Before marking the tracker done, remove this transient plan and the transient detailed spec after
  confirming all durable content is represented in canonical files.

## Steps

1. Add `.github/CODEOWNERS`.
2. Edit `CODE_OF_CONDUCT.md` enforcement wording to use the supplied contact address and remove the
   placeholder sentence.
3. Edit `docs/architecture.md` naming text.
4. Run focused text checks:

   ```bash
   test -f .github/CODEOWNERS
   grep -n '^\\* @aryeko$' .github/CODEOWNERS
   grep -n 'aryekogan@gmail.com' CODE_OF_CONDUCT.md
   ! grep -n 'responsible for enforcement at \\[@aryeko\\]' CODE_OF_CONDUCT.md
   ! grep -n 'WorkflowKit API envelope' docs/architecture.md
   ```

5. Run configured verification:

   ```bash
   pnpm check
   ```

6. Run the configured pre-PR review.
7. Delete the transient spec and plan, update the tracker row to `done`, and commit the final
   tracker/docs state.
8. Open the PR, wait for configured CI and Codex review, address findings if any, then squash merge
   if gates pass.
