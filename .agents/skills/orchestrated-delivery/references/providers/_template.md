# Provider Model Profile Template

Use this template when adding a model provider for orchestrated-delivery. Keep provider-specific model
IDs here, not in SKILL.md or generic references.

## Required fields

- `provider_profile`: stable lowercase provider name.
- `surface_match`: surfaces or worker tools this profile applies to.
- `model_classes`: concrete model IDs for each abstract class.
- `fallbacks`: stronger-class fallbacks for unavailable implementer models.
- `reviewer_safeguard`: the provider's frontier reviewer class and downgrade policy.

## Abstract model classes

| Class | Intended use | Concrete model ID |
|---|---|---|
| `cheap-coder` | Low-cost bounded implementation: light, mechanical, config, docs, test-split | `<provider model>` |
| `general-coder` | Default implementation when cheap-coder is too weak | `<provider model>` |
| `strong-coder` | Elevated implementation touching contracts, storage, worktrees, credentials, or safety-sensitive code | `<provider model>` |
| `frontier` | Critical implementation with architecture, migration, data-loss, or security-boundary risk | `<provider model>` |
| `frontier-reviewer` | All reviewer workers until evals justify reviewer downshifts | `<provider model>` |

## Route-specific notes

If the provider has more than one cheap implementation model, specify which concrete model to use for
light work versus standard mechanical/config work. If the provider cannot override worker models,
record `model override unavailable`, keep the model class, and inherit the parent model.

## Fallback policy

- Implementers may fall forward to the next stronger class and must record the reason.
- Reviewers and critical implementers must not fall back to a weaker class; stop or ask instead.
