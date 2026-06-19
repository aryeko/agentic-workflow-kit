# Orientation

This layer explains what the project is, what it must guarantee, and how to read the rest of the design.

## Read in order

1. [Mission and scope](mission-and-scope.md)
2. [Requirements](requirements.md)
3. [Glossary](glossary.md)
4. [Reading guide](reading-guide.md)
5. [Design conventions](conventions.md)
6. [Original design home](design-home-original.md)

## Mission in one sentence

Delegate well-scoped work to agent workers and land it as reviewed, merged changes under deterministic control, recoverability, evidence, and human supervision.

## Non-negotiable ideas

- Agents are workers, not orchestrators.
- The SDK/core owns deterministic decisions.
- Provider-specific behavior lives behind abstract provider interfaces.
- Completion and merge require recorded evidence, not worker prose.
- Human approval and safety gates are explicit.
