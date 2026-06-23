# OpenAI Model Profile

`provider_profile`: `openai`
`surface_match`: Codex desktop, Codex CLI, OpenAI-backed subagents or thread workers.

Keep concrete OpenAI model IDs here. Shared orchestration files should refer to abstract classes
unless they are documenting this profile.

## Model classes

| Class | Concrete model selection | Notes |
|---|---|---|
| `cheap-coder` | Light implementers: `gpt-5.3-codex-spark` when available. Standard mechanical/config/docs/test-split implementers: `gpt-5.4-mini`. | Use for bounded, low-risk implementation with a complete prompt contract. |
| `general-coder` | `gpt-5.4` | Use for standard implementation that is not purely mechanical/config/docs/test-split. |
| `strong-coder` | `gpt-5.4` | Use for elevated implementation touching storage, worktree, credential, contract, or safety-sensitive seams. |
| `frontier` | `gpt-5.5` | Use for critical implementation only, with high or xhigh effort and recorded rationale. |
| `frontier-reviewer` | `gpt-5.5` | Use for every reviewer until evals justify reviewer downshifts. |

## Fallbacks

| Planned class/route | If unavailable | Ledger fallback reason |
|---|---|---|
| `cheap-coder` light route using `gpt-5.3-codex-spark` | `gpt-5.4-mini`, then `gpt-5.4` | `Spark unavailable; used next stronger OpenAI implementer model` |
| `cheap-coder` standard mechanical route using `gpt-5.4-mini` | `gpt-5.4` | `mini unavailable; used next stronger OpenAI implementer model` |
| `general-coder` or `strong-coder` using `gpt-5.4` | `gpt-5.5` | `GPT-5.4 unavailable; used frontier OpenAI implementer model` |
| `frontier` or `frontier-reviewer` using `gpt-5.5` | Stop or ask | `required OpenAI frontier model unavailable` |

If the surface cannot pass a worker model override, keep the planned class and planned OpenAI model in
the ledger, inherit the parent model as `actual_model`, and record `model override unavailable`.
