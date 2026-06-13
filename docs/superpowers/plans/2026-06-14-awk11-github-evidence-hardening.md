# AWK11 implementation plan

## Scope

Harden GitHub collaboration evidence for child prompt output, evidence parsing, completion-gate
merge authority, and analyzer diagnostics. Keep the runtime child-evidence-first for V1 and do not
add parent-side GitHub polling.

## Steps

1. Add focused failing tests.
   - `packages/orchestrator/tests/tool-input.test.ts`: assert the child prompt requires explicit PR, CI, Codex review, merge, branch deletion, and blocker evidence.
   - `packages/orchestrator/tests/evidence-parser.test.ts`: assert structured `github` evidence is preserved; flat fields are filled; Codex eyes is pending, thumbs-up is approved, comments are findings; checks and branch deletion parse conservatively.
   - `packages/orchestrator/tests/completion-gate.test.ts`: assert nested `github.merge.commit` can satisfy auto-merge base-ref evidence.
   - `packages/orchestrator/tests/analysis.test.ts`: assert missing or failed policy-required GitHub evidence produces issues, and complete evidence does not.

2. Implement additive evidence types.
   - Update `packages/orchestrator/src/types.ts` with `GithubEvidence`, check, review, and merge interfaces.
   - Add `github?: GithubEvidence` to `ChildResultEvidence` without removing existing flat fields.

3. Strengthen child prompt evidence requirements.
   - Update `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts` PR policy text to require concrete final evidence for PR URL/number, CI, Codex review signal, findings triage, merge, branch deletion, and blockers.
   - Preserve existing Codex reaction/comment semantics and `rerequestAfterFix: false` behavior.

4. Harden evidence parsing.
   - Update `packages/orchestrator/src/drivers/codex-mcp/evidenceParser.ts` to read nested `github` evidence and structured aliases.
   - Normalize nested evidence into flat compatibility fields where possible.
   - Add conservative text parsing for checks, review reactions/comments, merge method/commit, and branch deletion.
   - Avoid treating pending review or unrelated PR/story text as success.

5. Wire completion-gate nested merge evidence.
   - Update `packages/orchestrator/src/runner/CompletionGate.ts` so auto-merge completion can use `settled.evidence.github.merge.commit` when flat `mergeCommit` is absent.

6. Add analyzer diagnostics.
   - Update `packages/orchestrator/src/analysis/runAnalyzer.ts` to read nested GitHub evidence.
   - Emit policy-aware issues for missing PR, missing/failed checks, missing/pending/untriaged review, missing merge evidence, and missing branch deletion evidence.
   - Keep old flat artifact evidence behavior intact.

7. Verify.
   - Run focused gate:

```bash
pnpm vitest run packages/orchestrator/tests/tool-input.test.ts packages/orchestrator/tests/evidence-parser.test.ts packages/orchestrator/tests/completion-gate.test.ts packages/orchestrator/tests/git-inspector.test.ts packages/orchestrator/tests/analysis.test.ts
```

   - Run full gate:

```bash
pnpm check
```

8. Pre-PR review and closeout.
   - Run the configured read-only subagent pre-PR review with the tracker row, story brief, spec, plan, diff, and verification evidence.
   - Fix any required findings within the configured loop limit and rerun verification.
   - Mark AWK11 `done`, commit, push, open PR, update the tracker PR column, then follow configured CI, Codex review, squash merge, branch deletion, and cleanup policy.
