# AWK1316 implementation plan

## Scope

Implement normalized Codex child-session speed policy with the public config value
`childSession.speed: derive | fast | standard`.

## Steps

1. Add failing config-loader tests:
   - default resolved speed is `derive`;
   - neutral `childSession.speed` wins over `codex.childSession.speed`;
   - raw `config.service_tier` remains compatible when speed is omitted or `derive`;
   - explicit `fast` or `standard` rejects raw `service_tier`.
2. Add failing Codex tool-input tests:
   - `derive` sends no service-tier override;
   - `fast` sends `service_tier: "fast"`;
   - `standard` sends `service_tier: null` and `notice.fast_default_opt_out: true` while preserving existing notice fields.
3. Implement schema/types/resolution:
   - extend `ChildSessionSchema`;
   - add `ChildSessionSpeed` and resolved field;
   - merge speed through the neutral/legacy alias path;
   - add conflict validation.
4. Implement Codex driver mapping in `toolInput.ts`.
5. Update generated schema, config docs, presets, plugin fixture copies, README, architecture docs, PRD/design docs, and tracker docs.
6. Run focused verification:
   - `pnpm --dir packages/orchestrator exec vitest run --config vitest.config.ts tests/config-loader.test.ts tests/tool-input.test.ts`
   - `pnpm --dir packages/orchestrator exec vitest run --config vitest.config.ts tests/schema-drift.test.ts tests/config-loader.test.ts tests/tool-input.test.ts tests/preset.test.ts tests/mcp-tool-helpers.test.ts`
   - `pnpm vitest run --coverage=false test/config-schema.test.ts test/config-doc-sync.test.ts test/presets.test.ts test/plugin-manifest.test.ts test/docs-current-state.test.ts test/example-tracker.test.ts test/example-prd.test.ts`
7. Run full verification:
   - `pnpm check`
   - `git diff --check`
8. Run configured pre-PR review in `subagent` mode before marking the tracker row done.
9. After review passes, mark AWK1316 done, remove transient `docs/superpowers` spec/plan artifacts, commit completion, open a PR, wait for configured CI and Codex review, then auto-merge if all gates pass.
