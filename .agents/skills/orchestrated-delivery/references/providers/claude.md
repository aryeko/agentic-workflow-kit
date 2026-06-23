# Claude Model Profile

`provider_profile`: `claude`
`surface_match`: Claude Code (CLI, desktop, IDE, web), Anthropic-backed `Agent` subagents or
background-task workers.

Keep concrete Claude model IDs here. Shared orchestration files should refer to abstract classes
unless they are documenting this profile.

Claude Code passes worker model overrides through the `Agent` tool's `model` field; this profile uses
the short names `haiku` / `sonnet` / `opus`. The short name and the concrete model ID are both
recorded below; route by the short name at dispatch and record the concrete ID as `planned_model` in
the ledger.

## Model classes

| Class | Concrete model selection | `Agent` model | Notes |
|---|---|---|---|
| `cheap-coder` | Light implementers and standard mechanical/config/docs/test-split implementers: `claude-haiku-4-5`. | `haiku` | Claude Code has a single cheapest coding tier; light and standard-mechanical routes both resolve to Haiku (there is no separate sub-Haiku "spark"-equivalent). Use only with a complete prompt contract. |
| `general-coder` | `claude-sonnet-4-6` | `sonnet` | Use for standard implementation that is not purely mechanical/config/docs/test-split. Run at the standard tier's `medium` effort. |
| `strong-coder` | `claude-sonnet-4-6` | `sonnet` | Elevated implementation touching storage, worktree, credential, contract, or safety-sensitive seams. **Same model as `general-coder`, run at higher effort** (elevated tier → `high`); the tier/effort, not the model, separates the two. |
| `frontier` | `claude-opus-4-8` | `opus` | Use for critical implementation only, with high or xhigh effort and recorded rationale. |
| `frontier-reviewer` | `claude-opus-4-8` | `opus` | Use for every reviewer until evals justify reviewer downshifts; never route a reviewer below this tier. |

Tier ladder: `haiku` < `sonnet` < `opus`. `general-coder` and `strong-coder` share
`claude-sonnet-4-6`, separated only by effort (`medium` vs `high`). `claude-opus-4-8` is the top tier
and the sole `frontier` / `frontier-reviewer` model; never substitute a lower tier for either.

## Route-specific notes

- `cheap-coder` light vs standard-mechanical: both routes resolve to `claude-haiku-4-5`. If a future
  cheaper coding tier becomes available, document the light-vs-mechanical split here as openai.md does.
- Claude Code exposes the model override on the `Agent` tool, so model routing is normally available.
  If the surface in use cannot pass a worker model override, record `model override unavailable`, keep
  the planned class, and inherit the parent model as `actual_model`.

## Fallbacks

| Planned class/route | If unavailable | Ledger fallback reason |
|---|---|---|
| `cheap-coder` using `claude-haiku-4-5` | `claude-sonnet-4-6`, then `claude-opus-4-8` | `Haiku unavailable; used next stronger Claude implementer model` |
| `general-coder` or `strong-coder` using `claude-sonnet-4-6` | `claude-opus-4-8` | `Sonnet unavailable; used next stronger Claude implementer model` |
| `frontier` or `frontier-reviewer` using `claude-opus-4-8` | Stop or ask | `required Claude frontier model unavailable` |

## Fallback policy

- Implementers may fall forward to the next stronger class and must record the reason.
- Reviewers and critical implementers must not fall back to a weaker class. `claude-opus-4-8` is the
  sole `frontier` / `frontier-reviewer` model; if it is unavailable, stop or ask rather than downgrade.
