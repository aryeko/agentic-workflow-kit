---
title: AWK1316 detailed technical story spec
owner: codex-2026-06-15T22-47-03Z
last-reviewed: 2026-06-16
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1316.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
---

# AWK1316 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK1316.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Global-only `childSession.speed` vs per-profile override? | Add global `childSession.speed` and compatibility alias `codex.childSession.speed`; do not add per-profile speed in this story. | The requested force-standard behavior applies to child-session launch defaults. Global policy is the smallest public surface and can be extended later if implementer/reviewer speed divergence becomes necessary. |
| Reject conflict vs normalized speed wins over raw service-tier keys? | Reject explicit `speed: fast` or `speed: standard` when raw `childSession.config.service_tier` or `codex.childSession.config.service_tier` is also configured. | Cost/routing intent must be unambiguous. Existing raw pass-through remains compatible when normalized speed is unset or `derive`. |
| How does Codex Standard map? | Emit `service_tier: null` and merge `notice.fast_default_opt_out: true` into the raw Codex config. | Codex Standard is an opt-out/clear behavior for inherited Fast mode, not a literal `standard` service-tier value. |
| Should launch artifacts record speed separately? | No new launch artifact field. Resolved config includes `childSession.speed`. | Keeps the story scoped to config/schema/tool-input behavior and avoids inventing duplicate evidence fields. |

## Exact types/contracts

- Add `ChildSessionSpeed = "derive" | "fast" | "standard"` to `packages/orchestrator/src/types.ts`.
- Add required resolved field `ResolvedChildSessionConfig.speed`.
- Extend the Zod `ChildSessionSchema` with optional source `speed`.
- Resolved config defaults source-omitted speed to `derive`.
- Compatibility alias merge keeps `childSession` winning over `codex.childSession` per field.
- Validation rejects:
  - `childSession.speed: fast|standard` plus raw `childSession.config.service_tier`.
  - `childSession.speed: fast|standard` plus raw `codex.childSession.config.service_tier`.
- Validation accepts raw `config.service_tier` when normalized speed is omitted or `derive`.
- Codex MCP tool input maps:
  - `derive`: no `service_tier` override and no `notice.fast_default_opt_out`.
  - `fast`: `config.service_tier = "fast"`.
  - `standard`: `config.service_tier = null` and `config.notice.fast_default_opt_out = true`.

## Exact files/modules

```text
packages/orchestrator/src/config/schema.ts                 Add speed enum and conflict validation.
packages/orchestrator/src/config/configLoader.ts           Resolve default/merged child-session speed.
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts   Map normalized speed to Codex MCP config.
packages/orchestrator/src/types.ts                         Export ChildSessionSpeed and resolved field.
packages/orchestrator/tests/config-loader.test.ts          Cover defaults, alias merge, raw compatibility, conflicts.
packages/orchestrator/tests/tool-input.test.ts             Cover derive, fast, and standard launch payloads.
packages/orchestrator/tests/mcp-tool-helpers.test.ts       Assert default speed survives helper loading.
test/config-schema.test.ts                                 Cover generated JSON Schema speed enum.
references/config-schema.md                                Document public config.
references/config.schema.json                              Regenerate from Zod schema.
presets/*.yaml                                             Make default `childSession.speed: derive` explicit.
plugins/agentic-workflow-kit/**                            Sync fixture docs/schema/presets.
README.md, docs/architecture.md                            Document the runtime policy knob.
docs/prds/agentic-workflow-kit-redesign/**                 Fold durable PRD/design updates into canonical docs.
docs/tracks/agentic-workflow-kit-redesign/**               Add and complete AWK13.16 tracker scope.
```

## Query/schema/prompt/event/component design

No database, prompt, event, route, or component changes.

Schema design:

```yaml
childSession:
  speed: derive # derive | fast | standard
```

`codex.childSession.speed` remains a compatibility alias. Raw `childSession.config` remains a
driver-specific escape hatch, but explicit normalized speed rejects raw `service_tier` conflicts.

## Tests

- `pnpm --dir packages/orchestrator exec vitest run --config vitest.config.ts tests/config-loader.test.ts tests/tool-input.test.ts`
- `pnpm --dir packages/orchestrator exec vitest run --config vitest.config.ts tests/schema-drift.test.ts tests/config-loader.test.ts tests/tool-input.test.ts tests/preset.test.ts tests/mcp-tool-helpers.test.ts`
- `pnpm vitest run --coverage=false test/config-schema.test.ts test/config-doc-sync.test.ts test/presets.test.ts test/plugin-manifest.test.ts test/docs-current-state.test.ts test/example-tracker.test.ts test/example-prd.test.ts`
- `pnpm check`

## Migration/deploy concerns

Backward-compatible. Existing configs without `childSession.speed` resolve to `derive`. Existing raw
`childSession.config.service_tier` remains valid when normalized speed is not explicitly `fast` or
`standard`. Presets make `derive` explicit without changing runtime behavior.

## Blocking technical questions

None
